import fs from 'fs';
import path from 'path';
import utils from '../utils/utils';
import { WatchedData, WatchedFile, WatchedFolder } from '../docs/docs';
import eventsManager from '../events/manager';

class Snapshot {
    readonly #_data = {
        path: '',
        children: { current: new Map<string, WatchedData>(), temp: new Map<string, WatchedData>() },
        /** On update handlers */
        onUpdate: [] as { onlyOnce: boolean, handler: () => void }[],
    };

    readonly #_flags = { processing: false, deleted: false };

    constructor(path_: string) {
        this.#_data.path = path_;
    }

    readonly #_helpers = {
        /**
         * Scans the given path and adds all files and folders to the given Map.
         * @param path_ The path to scan.
         * @param children The Map to add the scanned data to.
         */
        scan: async (path_: string, children: Map<string, WatchedData>) => {
            const content = await fs.promises.readdir(path_, { withFileTypes: true });
            const files = content.filter(item => item.isFile());
            const folders = content.filter(item => item.isDirectory());

            for (const file of files) {
                const filePath = path.join(path_, file.name);
                let stats: fs.Stats;
                try {
                    stats = await fs.promises.stat(filePath);
                } catch (error) {
                    if ((error as any).code === 'ENOENT') {
                        // File disappeared, skip it safely
                        continue;
                    }

                    if ((error as any).code === 'EPERM') {
                        console.warn(`[VOM] Skipping stat for "${filePath}" due to EPERM (permission denied).`);
                        continue;
                    }

                    throw error;
                }

                const watchedFile: WatchedFile = {
                    path: filePath,
                    name: file.name,
                    size: stats.size,
                    mTime: stats.mtime
                }

                children.set(filePath, watchedFile);
            }

            for (const folder of folders) {
                const folderPath = path.join(path_, folder.name);
                let stats: fs.Stats;
                try {
                    stats = await fs.promises.stat(folderPath);
                } catch (error) {
                    if ((error as any).code === 'ENOENT') {
                        // Folder disappeared, skip it safely
                        continue;
                    }

                    if ((error as any).code === 'EPERM') {
                        console.warn(`[VOM] Skipping stat for "${folderPath}" due to EPERM (permission denied).`);
                        continue;
                    }
                    throw error;
                }

                const watchedFolder: WatchedFolder = {
                    path: folderPath,
                    name: folder.name,
                    size: stats.size,
                    mTime: stats.mtime,
                    children: new Map<string, WatchedData>()
                }

                await this.#_helpers.scan(folderPath, watchedFolder.children);
                children.set(folderPath, watchedFolder);
            }
        },
        compareMaps: async (currentData: Map<string, WatchedData>, newData: Map<string, WatchedData>) => {
            const removed: { path: string, data: WatchedData }[] = [];
            const added: { path: string, data: WatchedData }[] = [];

            const allKeys = new Set([...currentData.keys(), ...newData.keys()]);

            for (const key of allKeys) {
                const current = currentData.get(key);
                const temp = newData.get(key);

                if (current && temp) {
                    if (utils.areSameWatchedDataTypes(current, temp)) {
                        const areFolders = utils.isWatchedFolder(current) && utils.isWatchedFolder(temp);

                        if (areFolders) {
                            await this.#_helpers.compareMaps(current.children, temp.children);
                        } else if (current.mTime.getTime() !== temp.mTime.getTime()) {
                            eventsManager.emit.update({ path: key, type: areFolders ? 'Folder' : 'File' });
                        }
                    } else {
                        removed.push({ path: key, data: current });
                        added.push({ path: key, data: temp });
                    }
                } else if (current) {
                    removed.push({ path: key, data: current });
                } else if (temp) {
                    added.push({ path: key, data: temp });
                }
            }

            // Attempt rename detection
            for (let i = removed.length - 1; i >= 0; i--) {
                const removedItem = removed[i];
                for (let j = added.length - 1; j >= 0; j--) {
                    const addedItem = added[j];

                    const isRename =
                        utils.areSameWatchedDataTypes(removedItem.data, addedItem.data) &&
                        removedItem.data.size === addedItem.data.size &&
                        removedItem.data.mTime.getTime() === addedItem.data.mTime.getTime();

                    if (isRename) {
                        const type = utils.isWatchedFolder(removedItem.data) ? 'Folder' : 'File';
                        this.#_helpers.rename(removedItem.path, addedItem.path);

                        removed.splice(i, 1);
                        added.splice(j, 1);
                        break;
                    }
                }
            }

            // Remaining are real add/remove
            for (const removedItem of removed) {
                eventsManager.emit.remove({ path: removedItem.path, type: utils.isWatchedFolder(removedItem.data) ? 'Folder' : 'File' });
            }

            for (const addedItem of added) {
                eventsManager.emit.add({ path: addedItem.path, type: utils.isWatchedFolder(addedItem.data) ? 'Folder' : 'File' });
            }
        },
        getMapOf: (path_: string): LocatedWatchedItem | undefined => {
            const pathToCheck = path.dirname(path_);
            const key = path_;

            if (this.#_data.path === pathToCheck) {
                const item = this.#_data.children.current.get(key);
                if (item) {
                    return {
                        parentMap: this.#_data.children.current,
                        item
                    };
                }
                return undefined;
            }

            const search = (map: Map<string, WatchedData>): LocatedWatchedItem | undefined => {
                for (const [, value] of map) {
                    if (utils.isWatchedFolder(value)) {
                        if (value.children.has(key)) {
                            return {
                                parentMap: value.children,
                                item: value.children.get(key)!
                            };
                        }

                        const found = search(value.children);
                        if (found) return found;
                    }
                }
                return undefined;
            };

            return search(this.#_data.children.current);
        },
        /**
         * Renames a file or folder from the specified old prefix to the new prefix.
         * This function retrieves the map associated with the old prefix and updates
         * the watched data with the new path and name. If the map or data for the old
         * prefix cannot be found, it throws an error.
         * 
         * @param oldPrefix - The current path prefix of the file or folder to rename.
         * @param newPrefix - The new path prefix to rename the file or folder to.
         * @param type - The type of the watched object, either 'File' or 'Folder'.
         * @throws Will throw an error if no map or data is found for the oldPrefix.
         */
        rename: (oldPrefix: string, newPrefix: string) => {
            const located = this.#_helpers.getMapOf(oldPrefix);
            if (!located) { throw new Error(`A serious error occurred while renaming ${oldPrefix} to ${newPrefix}: No map found for ${oldPrefix}`) }

            const { parentMap, item: watchedData } = located;
            const isFolder = utils.isWatchedFolder(watchedData);

            if (isFolder) {
                const snapshot = Array.from(watchedData.children.values());
                for (const child of snapshot) {
                    const childRelative = path.relative(oldPrefix, child.path);
                    const childNewPath = path.join(newPrefix, childRelative);

                    this.#_helpers.rename(child.path, childNewPath);
                }
            }

            parentMap.delete(oldPrefix);
            parentMap.set(newPrefix, watchedData);

            watchedData.path = newPrefix;
            watchedData.name = path.basename(newPrefix);

            eventsManager.emit.rename({ oldPath: oldPrefix, newPath: newPrefix, type: isFolder ? 'Folder' : 'File' });
        },
        /**
         * Runs all the handlers for the "update" event that are stored in this Snapshot.
         * If the handler's onlyOnce property is true, it will be removed from the list
         * after it has been called.
         */
        runOnUpdateHandlers: () => {
            for (const item of [...this.#_data.onUpdate]) {
                const { handler, onlyOnce } = item;
                handler();
                if (onlyOnce) {
                    this.#_data.onUpdate.splice(this.#_data.onUpdate.indexOf(item), 1);
                }
            }
        }
    }

    /**
     * Updates the snapshot of the directory being watched.
     * @returns a Promise that resolves when the snapshot has been updated
     */
    async update() {
        if (this.#_flags.processing || this.#_flags.deleted) { return }
        this.#_flags.processing = true;

        try {
            if (!fs.existsSync(this.#_data.path)) {
                this.#_flags.deleted = true;
                return;
            }

            await this.#_helpers.scan(this.#_data.path, this.#_data.children.temp);

            if (this.#_data.children.current.size > 0) {
                await this.#_helpers.compareMaps(this.#_data.children.current, this.#_data.children.temp);
            }

            this.#_data.children.current = new Map(this.#_data.children.temp);
            this.#_data.children.temp.clear();

            this.#_helpers.runOnUpdateHandlers();
        } catch (error) {
            if (error instanceof Error) { error.message = `[VOM] Unable to update snapshot: ${error.message}` }
            throw error;
        } finally {
            this.#_flags.processing = false;
        }
    }

    /**
     * Registers a handler to be called when the snapshot is updated.
     * 
     * @param handler - The function to be called when an update occurs.
     * @param onlyOnce - If true, the handler will be removed after it is called once.
     *                   Defaults to false, meaning the handler will be called on every update.
     * @throws {TypeError} If the handler is not a function.
     * @throws {TypeError} If onlyOnce is not a boolean.
     */
    onUpdate(handler: () => any, onlyOnce: boolean = false) {
        if (typeof handler !== 'function') throw new TypeError('onUpdate must be a function.');
        if (typeof onlyOnce !== 'boolean') throw new TypeError('onUpdate onlyOnce must be a boolean.');
        this.#_data.onUpdate.push({ handler, onlyOnce });
    }

    /**
     * Indicates whether the snapshot is currently being updated.
     * @returns true if the snapshot is being updated, false otherwise.
     */
    get isProcessing() { return this.#_flags.processing; }

    /**
     * Indicates whether the snapshot has been marked as deleted.
     * @returns true if the snapshot is marked as deleted, false otherwise.
     */
    get isDeleted() { return this.#_flags.deleted; }

    /**
     * Returns a Map of the current children of the directory being watched.
     * The keys of the Map are the paths of the children, and the values are
     * `WatchedData` objects representing the children.
     * @returns a Map of the current children of the directory being watched
     */
    get children() {
        return this.#_data.children.current;
    }

    /**
     * Returns the path of the directory being watched in the snapshot.
     * @returns The path of the directory being watched.
     */
    get path() {
        return this.#_data.path;
    }

    /**
     * Returns a JSON-serializable object representing the current snapshot of the
     * directory being watched. The object is a nested object where each key is a
     * file/folder name and each value is either another nested object (if the
     * value is a folder) or the file/folder name (if the value is a file). This
     * can be used to serialize the snapshot to a JSON file or send it over a
     * network connection.
     * @returns a JSON-serializable object representing the current snapshot
     * @private
     */
    _toJSON() {
        const extract = (data: Map<string, WatchedData>) => {
            const result: SnapshotJSON = {};
            for (const content of data.values()) {
                result[content.name] = utils.isWatchedFolder(content) ? extract(content.children) : content.name;
            }
            return result;
        };

        return extract(this.children);
    }

    /**
     * Updates the internal path of the snapshot to the specified new path.
     * @param newPath The new path to set for the snapshot.
     * @private
     */
    _updatePath(newPath: string) {
        this.#_data.path = newPath;
    }
}

export default Snapshot;

type SnapshotJSON = {
    [path: string]: string | SnapshotJSON;
}

type LocatedWatchedItem = {
    parentMap: Map<string, WatchedData>,
    item: WatchedData
};
