import atomix from "@nasriya/atomix";
import VirtualObjectManager from "./vom/vom";
import Watcher from "./watcher/Watcher";
import eventsManager from "./events/manager";
import path from "path";
import fs from "fs";
import { WatchOptions } from "./docs/docs";

export type {
    WatchOptions,
    OnWatchedDataUpdateHandler,
    onWatchedDataRemoveHandler,
    onWatchedDataRenameHandler,
    onWatchedDataAddHandler,
    WatchedDataChangeEvent,
    onWatchedDataChangeHandler,
    RenameEvent,
    UpdateEvent,
    RemoveEvent,
    AddEvent,
    ChangeEvent,
    WatchedFile,
    WatchedFolder,
    WatchedData
} from './docs/docs';

export { Watcher } from "./watcher/Watcher";

class Overwatch {
    readonly #_vom = new VirtualObjectManager();
    readonly #_watching = new Map<string, Watcher[]>();

    readonly #_helpers = {
        getWatchers: (path: string) => {
            const watchers: Watcher[] = [];
            const entries = Array.from(this.#_watching)
            for (const [key, value] of entries) {
                if (path.startsWith(key)) {
                    watchers.push(...value);
                }
            }

            return watchers;
        },
        getDescendantRecords: (path_: string): Map<string, Watcher[]> => {
            const map = new Map<string, Watcher[]>();

            for (const [key, value] of this.#_watching) {
                if (key === path_ || key.startsWith(path_ + path.sep)) {
                    map.set(key, value);
                }
            }

            return map;
        },
        validateWatchOptions: (options?: WatchOptions) => {
            if (options === undefined) { return }
            if (typeof options !== 'object') { throw new TypeError('options must be an object.'); }
            const hasOwnProperty = atomix.dataTypes.record.hasOwnProperty.bind(atomix.dataTypes.record);

            if ('include' in options && hasOwnProperty(options, 'include')) {
                if (!Array.isArray(options.include)) { throw new TypeError('options.include (when provided) must be an array.'); }
                for (const item of options.include) {
                    if (typeof item === 'string' || item instanceof RegExp) { continue; }
                    throw new TypeError('options.include (when provided) must only contain strings or regular expressions.');
                }
            }

            if ('exclude' in options && hasOwnProperty(options, 'exclude')) {
                if (!Array.isArray(options.exclude)) { throw new TypeError('options.exclude (when provided) must be an array.'); }
                for (const item of options.exclude) {
                    if (typeof item === 'string' || item instanceof RegExp) { continue; }
                    throw new TypeError('options.exclude (when provided) must only contain strings or regular expressions.');
                }
            }
        },
        /**
         * Determines whether the user event should be emitted for the given watcher and normalized path.
         * @param watcher The watcher to check
         * @param normalizedPath The normalized path to check
         * @returns Whether the user event should be emitted
         */
        shouldEmitUserEvent: (watcher: Watcher, normalizedPath: string) => {
            const { include, exclude } = watcher._filters;
            const isExcluded = exclude.some(rule =>
                typeof rule === 'string' ? normalizedPath === rule : rule.test(normalizedPath)
            );

            const isIncluded = include.some(rule =>
                typeof rule === 'string' ? normalizedPath === rule : rule.test(normalizedPath)
            );

            if (isExcluded) {
                // Only emit if explicitly included despite being excluded
                return isIncluded;
            }

            // Not excluded, but if includes exist, it must match one
            if (include.length > 0) {
                return isIncluded;
            }

            // No include/exclude? Accept everything
            return true;
        }
    }

    constructor() {
        eventsManager.on('shutdown', () => this.#_watching.clear());

        eventsManager.on('snapshotRemoved', (snapshot) => {
            const watchers = this.#_helpers.getWatchers(snapshot.path);
            for (const watcher of watchers) {
                watcher._handlers.onRootRemoved();
                watcher._handlers.onChange({ type: 'rootRemoved' });
                this.#_watching.delete(watcher.path);
            }
        })

        eventsManager.on('update', (event) => {
            const watchers = this.#_helpers.getWatchers(event.path);
            for (const watcher of watchers) {
                if (this.#_helpers.shouldEmitUserEvent(watcher, event.path)) {
                    watcher._handlers.onUpdate(event);
                    watcher._handlers.onChange({ type: 'update', event });
                }
            }
        })

        eventsManager.on('remove', (event) => {
            const watchers = this.#_helpers.getWatchers(event.path);
            for (const watcher of watchers) {
                if (this.#_helpers.shouldEmitUserEvent(watcher, event.path)) {
                    watcher._handlers.onRemove(event);
                    watcher._handlers.onChange({ type: 'remove', event });
                }

                const shouldRemoveWatcher = watcher.path === event.path || watcher.path.startsWith(event.path + path.sep);
                if (shouldRemoveWatcher) {
                    const record = this.#_watching.get(watcher.path)!;
                    record.splice(record.indexOf(watcher), 1);
                    if (record.length === 0) {
                        this.#_watching.delete(watcher.path);
                    }
                }
            }
        })

        eventsManager.on('renamed', (event) => {
            const watchers = this.#_helpers.getWatchers(event.oldPath);
            const descendantRecords = this.#_helpers.getDescendantRecords(event.oldPath);

            for (const watcher of watchers) {
                if (this.#_helpers.shouldEmitUserEvent(watcher, event.oldPath)) {
                    watcher._handlers.onRename(event);
                    watcher._handlers.onChange({ type: 'rename', event });
                }
            }

            for (const [oldWatcherPath, record] of descendantRecords) {
                const relative = path.relative(event.oldPath, oldWatcherPath);
                const updatedPath = path.join(event.newPath, relative);

                for (const watcher of record) {
                    watcher._renameTo(updatedPath);
                }

                this.#_watching.delete(oldWatcherPath);
                this.#_watching.set(updatedPath, record);
            }
        })

        eventsManager.on('add', (event) => {
            const watchers = this.#_helpers.getWatchers(event.path);

            for (const watcher of watchers) {
                if (this.#_helpers.shouldEmitUserEvent(watcher, event.path)) {
                    watcher._handlers.onAdd(event);
                    watcher._handlers.onChange({ type: 'add', event });
                }
            }
        })
    }

    /**
     * Registers a watcher for the specified path, which can be a file or directory.
     *
     * @param path_ - The absolute or relative path to the file or directory to watch.
     *                The path will be resolved and normalized before being tracked.
     * @param options - Optional configuration options for the watcher.
     *                  If watching a directory, you can specify filters to include or exclude specific paths.
     * @returns A `Watcher` instance for the specified path.
     * @throws Will throw an error if the path does not exist or cannot be resolved.
     */
    async watch(path_: string, options?: WatchOptions) {
        try {
            const resolvedPath = atomix.path.normalizePath(path_);
            const isFile = fs.statSync(resolvedPath).isFile();
            const directory = isFile ? path.dirname(resolvedPath) : resolvedPath;
            this.#_helpers.validateWatchOptions(options);

            await this.#_vom.snapshot(directory);

            const watcher = new Watcher(resolvedPath, isFile === true ? 'File' : 'Directory', options);
            if (this.#_watching.has(resolvedPath)) {
                this.#_watching.get(resolvedPath)!.push(watcher);
            } else {
                this.#_watching.set(resolvedPath, [watcher]);
            }

            return watcher;
        } catch (error) {
            if (error instanceof Error) { error.message = `[Overwatch] ${error.message}` }
            throw error;
        }
    }

    /**
     * Registers a watcher for the specified file path.
     *
     * @param path_ - The absolute or relative path to the file to watch.
     *                The path will be resolved and normalized before being tracked.
     * @param options - Optional configuration options excluding `exclude` and `include` filters.
     *                  These filters are irrelevant since a file is not a directory.
     * @returns A `Watcher` instance for the specified file.
     * @throws Will throw an error if the path does not exist or cannot be resolved.
     */
    async watchFile(path_: string, options?: Exclude<WatchOptions, 'exclude' | 'include'>) {
        try {
            const watcher = await this.watch(path_, options);
            return watcher;
        } catch (error) {
            if (error instanceof Error) { error.message = `[Overwatch] Unable to watch ${path_}: ${error.message}` }
            throw error;
        }
    }

    /**
     * Registers a watcher for the specified directory path.
     *
     * @param path_ - The absolute or relative path to the directory to watch.
     *                The path will be resolved and normalized before being tracked.
     * @param options - Optional configuration options including filters to restrict which files and folders are watched.
     * @returns A `Watcher` instance for the specified directory.
     * @throws Will throw an error if the path does not exist or cannot be resolved.
     */
    async watchFolder(path_: string, options?: WatchOptions) {
        try {
            const watcher = await this.watch(path_, options);
            return watcher;
        } catch (error) {
            if (error instanceof Error) { error.message = `[Overwatch] Unable to watch ${path_}: ${error.message}` }
            throw error;
        }
    }

    /**
     * Gets the current detection interval in milliseconds.
     *
     * This value determines how frequently the file system is scanned
     * for changes across all watched paths.
     *
     * @returns The current detection interval in milliseconds.
     */
    get detectionInterval(): number { return this.#_vom.dispatchInterval }

    /**
     * Sets the detection interval in milliseconds.
     *
     * This controls how often Overwatch checks the file system for changes.
     * A lower interval results in faster detection but higher CPU usage.
     *
     * @param interval - The interval in milliseconds (minimum: 200ms).
     * @throws {TypeError} If the provided value is not a finite number.
     * @throws {RangeError} If the value is below 200 milliseconds.
     */
    set detectionInterval(interval: number) {
        if (!Number.isFinite(interval)) throw new TypeError(`detectionInterval must be a finite number`);
        if (interval < 200) throw new RangeError(`detectionInterval must be at least 200ms`);
        this.#_vom.dispatchInterval = interval;
    }

    /**
     * Provides runtime control over the internal scanning engine.
     *
     * Use this property to pause or resume the file system scanning engine manually,
     * without removing or altering existing watchers. This is useful for temporarily
     * reducing resource usage during periods when file monitoring is not needed.
     *
     * Example:
     * ```ts
     * overwatch.control.pause();  // Temporarily stop scanning
     * overwatch.control.resume(); // Resume scanning
     * console.log(overwatch.control.isRunning()); // Check engine state
     * ```
     *
     * This property is read-only and exposes the following methods:
     * - `pause()` – Stops the internal scanning engine.
     * - `resume()` – Starts or resumes scanning.
     * - `isRunning()` – Returns a boolean indicating whether scanning is active.
     */
    readonly control = atomix.dataTypes.record.freeze({
        /**
         * Starts or resumes the internal scanning engine.
         *
         * This method triggers the engine responsible for detecting changes to all watched paths.
         * If the engine is already running, calling this again has no effect.
         *
         * Use this to resume file system monitoring after calling `pause()`.
         * @since v1.1.0
         */
        resume: () => this.#_vom.dispatch(),

        /**
         * Temporarily pauses the internal scanning engine.
         *
         * While paused, the system will not scan for changes or emit any file system events.
         * Existing watchers remain intact and will resume functioning once `resume()` is called.
         *
         * Useful for temporarily reducing I/O load without removing watchers.
         * @since v1.1.0
         */
        pause: () => this.#_vom.pause(),

        /**
         * Indicates whether the scanning engine is currently active.
         *
         * @returns `true` if the engine is currently scanning for changes,
         *          `false` if it has been paused via `pause()`.
         *
         * You can use this to programmatically check the system state before pausing or resuming.
         * @since v1.1.0
         */
        isRunning: () => this.#_vom.isRunning
    });

}

const overwatch = new Overwatch;
export default overwatch;