import atomix from "@nasriya/atomix";
import { onWatchedDataAddHandler, onWatchedDataChangeHandler, onWatchedDataRemoveHandler, onWatchedDataRenameHandler, OnWatchedDataUpdateHandler, WatchOptions } from "../docs/docs";

class Watcher {
    #_path: string;
    readonly #_type: 'File' | 'Directory';
    readonly #_filters: Pick<Required<WatchOptions>, 'include' | 'exclude'> = { include: [], exclude: [] }
    readonly #_userEvents = {
        onUpdate: (() => { }) as OnWatchedDataUpdateHandler,
        onRemove: (() => { }) as onWatchedDataRemoveHandler,
        onRename: (() => { }) as onWatchedDataRenameHandler,
        onAdd: (() => { }) as onWatchedDataAddHandler,
        onChange: (() => { }) as onWatchedDataChangeHandler,
        onRootRemoved: (() => { })
    }

    readonly #_helpers = {
        /**
        * Normalizes a filter rule by converting glob-like strings to regular expressions.
        * @param rule The filter rule to normalize
        * @returns The normalized filter rule
        */
        normalizeFilterRule(rule: string | RegExp): string | RegExp {
            if (typeof rule === 'string') {
                if (atomix.dataTypes.regex.guard.isGlobLike(rule)) {
                    return atomix.dataTypes.regex.globToRegExp(rule);
                } else {
                    return atomix.path.normalizePath(rule);
                }
            }
            return rule;
        }
    }

    constructor(path_: string, type: 'File' | 'Directory', watchOptions?: WatchOptions) {
        this.#_path = path_;
        this.#_type = type;

        if (type === 'Directory' && watchOptions) {
            this.#_filters.include = watchOptions.include || this.#_filters.include;
            this.#_filters.exclude = watchOptions.exclude || this.#_filters.exclude;
        }

        this.#_filters.include = this.#_filters.include.map(rule => this.#_helpers.normalizeFilterRule(rule));
        this.#_filters.exclude = this.#_filters.exclude.map(rule => this.#_helpers.normalizeFilterRule(rule));
        const hasOwnProperty = atomix.dataTypes.record.hasOwnProperty;
        
        if (hasOwnProperty(watchOptions, 'onChange')) {
            this.onChange(watchOptions?.onChange!);
        }

        if (hasOwnProperty(watchOptions, 'onUpdate')) {
            this.onUpdate(watchOptions?.onUpdate!);
        }

        if (hasOwnProperty(watchOptions, 'onRemove')) {
            this.onRemove(watchOptions?.onRemove!);
        }

        if (hasOwnProperty(watchOptions, 'onRename')) {
            this.onRename(watchOptions?.onRename!);
        }

        if (hasOwnProperty(watchOptions, 'onAdd')) {
            this.onAdd(watchOptions?.onAdd!);
        }

        if (hasOwnProperty(watchOptions, 'onRootRemoved')) {
            this.onRootRemoved(watchOptions?.onRootRemoved!);
        }
    }

    /**
     * Returns a read-only object containing the include and exclude filters for the watched directory.
     * If the watched object is a file, the returned object will contain empty arrays for both `include` and `exclude`.
     * @returns A read-only object containing the include and exclude filters.
     * @private
     */
    get _filters() {
        return {
            include: [...this.#_filters.include],
            exclude: [...this.#_filters.exclude]
        };
    }

    /**
     * A read-only object containing the user-provided handlers for the watched file or directory.
     * The properties of this object are:
     * - `onUpdate`: Triggered when the watched object has been updated.
     * - `onRemove`: Triggered when the watched object has been removed.
     * - `onRename`: Triggered when the watched object has been renamed.
     * - `onAdd`: Triggered when the watched object has been added.
     * - `onChange`: Triggered when the watched object has been changed (includes all other events).
     * @returns A read-only object containing the user-provided handlers.
     * @private
     */
    get _handlers() {
        return { ...this.#_userEvents };
    }

    /**
     * The type of the watched object, either `File` or `Directory`.
     * @returns The type of the watched object.
     */
    get type() { return this.#_type; }

    /**
     * The path of the watched object.
     * @returns The path of the watched object.
     */
    get path() { return this.#_path; }

    /**
     * Sets the handler for the "rootRemoved" event, which is called when the watched
     * directory or file is removed. The handler will be called with no arguments.
     * @param handler The handler to call when the watched directory or file is removed.
     */
    onRootRemoved(handler: () => void) {
        if (typeof handler !== 'function') throw new TypeError('onRootRemoved must be a function.');
        this.#_userEvents.onRootRemoved = handler;
    }

    /**
     * Sets the handler for the "update" event, which is called whenever the watched files are modified.
     * @param handler The handler to call when the watched files are modified. The handler must take a single argument, which is the path of the file that was modified.
     */
    onUpdate(handler: OnWatchedDataUpdateHandler) {
        if (typeof handler !== 'function') throw new TypeError('onUpdate must be a function.');
        if (handler.length !== 1) throw new TypeError('onUpdate must have a single argument.');
        this.#_userEvents.onUpdate = handler;
    }

    /**
     * Sets the handler for the "remove" event, which is called whenever a watched file or directory is removed.
     * @param handler The handler to call when a watched file or directory is removed. The handler must take a single argument, which is the path of the file or directory that was removed.
     */

    onRemove(handler: onWatchedDataRemoveHandler) {
        if (typeof handler !== 'function') throw new TypeError('onRemove must be a function.');
        if (handler.length !== 1) throw new TypeError('onRemove must have a single argument.');
        this.#_userEvents.onRemove = handler;
    }

    /**
     * Sets the handler for the "rename" event, which is called whenever a watched file or directory is renamed.
     * @param handler The handler to call when a watched file or directory is renamed. The handler must take two arguments, which are the old path and the new path of the renamed file or directory.
     */
    onRename(handler: onWatchedDataRenameHandler) {
        if (typeof handler !== 'function') throw new TypeError('onRename must be a function.');
        if (handler.length !== 1) throw new TypeError('onRename must have a single arguments.');
        this.#_userEvents.onRename = handler;
    }

    /**
     * Sets the handler for the "add" event, which is called whenever a file or directory is added to a watched directory.
     * @param handler The handler to call when a file or directory is added to a watched directory. The handler must take a single argument, which is the path of the added file or directory.
     */
    onAdd(handler: onWatchedDataRemoveHandler) {
        if (typeof handler !== 'function') throw new TypeError('onAdd must be a function.');
        if (handler.length !== 1) throw new TypeError('onAdd must have a single argument.');
        this.#_userEvents.onAdd = handler;
    }

    /**
     * Sets the handler for the "change" event, which is called whenever a watched file or directory is changed.
     * @param handler The handler to call when a watched file or directory is changed. The handler must take a single argument, which is the path of the file or directory that was changed.
     */
    onChange(handler: onWatchedDataChangeHandler) {
        if (typeof handler !== 'function') throw new TypeError('onChange must be a function.');
        if (handler.length > 1) throw new TypeError('onChange must have no more than a single argument.');
        this.#_userEvents.onChange = handler;
    }

    /**
     * Renames the currently watched path to the specified new path.
     * 
     * **Note:** This method is called internally when a file or directory is renamed.
     * @param path_ The new path to rename the watched object to.
     * @private Do NOT call this method.
     */
    _renameTo(path_: string) {
        this.#_path = path_
    }
}

export default Watcher;