import { WatchedData, WatchedFile, WatchedFolder } from "../docs/docs";
import path from 'path';

class Utils {

    /**
     * Converts a glob expression to a regular expression.
     * @param glob The glob expression to convert.
     * @param options Options to customize the conversion.
     * @param options.globstar Whether or not to enable globstar matching (e.g. `** /foo`).
     * @param options.flags A string containing additional flags to pass to the created RegExp.
     * @returns The regular expression representation of the glob expression.
     */
    globToRegExp(glob: string, options?: { globstar?: boolean; flags?: string }): RegExp {
        const globstar = options?.globstar ?? true;
        const flags = options?.flags ?? '';
        let re = '';
        let inGroup = false;

        for (let i = 0; i < glob.length; i++) {
            const char = glob[i];

            if ('^$+?.()=!|'.includes(char)) {
                re += '\\' + char;
            } else if (char === '*') {
                const prev = glob[i - 1];
                let starCount = 1;
                while (glob[i + 1] === '*') {
                    i++;
                    starCount++;
                }
                const next = glob[i + 1];

                const isGlobstar =
                    globstar && starCount > 1 && (prev === '/' || prev === undefined) && (next === '/' || next === undefined);

                if (isGlobstar) {
                    re += '((?:[^\\/]*(?:\\/|$))*)';
                    if (next === '/') i++; // skip slash after globstar
                } else {
                    re += '[^\\/]*';
                }
            } else if (char === '?') {
                re += '.';
            } else if (char === '{') {
                inGroup = true;
                re += '(';
            } else if (char === '}') {
                inGroup = false;
                re += ')';
            } else if (char === ',' && inGroup) {
                re += '|';
            } else if ('[]\\'.includes(char)) {
                re += '\\' + char;
            } else {
                re += char === '/' ? '\\/' : char;
            }
        }

        return new RegExp(flags.includes('g') ? re : `^${re}$`, flags);
    }

    /**
     * Checks if the given pattern is a glob-like pattern, meaning it contains at least one of the
     * characters `*` or `?`.
     * @param pattern The pattern to check.
     * @returns true if the given pattern is a glob-like pattern, false otherwise.
     */
    isGlobLike(pattern: string): boolean {
        return /[*?]/.test(pattern);
    }

    /**
     * Checks if the given WatchedData is a WatchedFile.
     * @param data The WatchedData to check.
     * @returns true if the given WatchedData is a WatchedFile, false otherwise.
     */
    isWatchedFile(data: WatchedData): data is WatchedFile {
        if (!data || typeof data !== 'object') {
            return false;
        }

        if (!(
            this.hasOwnProperty(data, 'path') &&
            this.hasOwnProperty(data, 'name') &&
            this.hasOwnProperty(data, 'size') &&
            this.hasOwnProperty(data, 'mTime')
        )) {
            return false;
        }

        if (
            typeof data.path !== 'string' ||
            typeof data.name !== 'string' ||
            typeof data.size !== 'number' ||
            typeof data.mTime !== 'object'
        ) {
            return false;
        }

        return true;
    }

    /**
     * Checks if the given WatchedData is a WatchedFolder.
     * @param data The WatchedData to check.
     * @returns true if the given WatchedData is a WatchedFolder, false otherwise.
     */
    isWatchedFolder(data: WatchedData): data is WatchedFolder {
        return this.isWatchedFile(data) && 'children' in data && this.hasOwnProperty(data, 'children') && data.children instanceof Map;
    }

    /**
     * Checks if the given object has the given property.
     * @param object The object to check.
     * @param property The property to check for.
     * @returns true if the object has the property, false otherwise.
     */
    hasOwnProperty(object: any, property: string) {
        return typeof object === 'object' && Object.prototype.hasOwnProperty.call(object, property);
    }

    /**
     * Checks if the given `WatchedData` objects are of the same type (i.e. both are `WatchedFolder`, or both are `WatchedFile`).
     * @param a The first `WatchedData` object to compare.
     * @param b The second `WatchedData` object to compare.
     * @returns true if the objects are of the same type, false otherwise.
     */
    areSameWatchedDataTypes(a: WatchedData, b: WatchedData) {
        const bothAreFiles = this.isWatchedFile(a) && this.isWatchedFile(b);
        const bothAreFolders = this.isWatchedFolder(a) && this.isWatchedFolder(b);
        return bothAreFiles || bothAreFolders;
    }

    /**
     * Checks if the current platform is Windows.
     * @returns true if the platform is Windows, false otherwise.
     */
    isWindows() {
        return process.platform === 'win32';
    }

    /**
     * Normalizes the given path by resolving it to an absolute path and converting 
     * it to lowercase if the current platform is Windows.
     * @param path_ The path to normalize.
     * @returns The normalized path.
     */
    normalizePath(path_: string) {
        const resolved = path.resolve(path_);
        return this.isWindows() ? resolved.toLowerCase() : resolved;
    }
}

const utils = new Utils();
export default utils;