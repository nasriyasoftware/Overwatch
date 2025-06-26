import atomix from "@nasriya/atomix";
import { WatchedData, WatchedFile, WatchedFolder } from "../docs/docs";

const hasOwnProperty = atomix.dataTypes.record.hasOwnProperty;

class Utils {
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
            hasOwnProperty(data, 'path') &&
            hasOwnProperty(data, 'name') &&
            hasOwnProperty(data, 'size') &&
            hasOwnProperty(data, 'mTime')
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
        return this.isWatchedFile(data) && 'children' in data && hasOwnProperty(data, 'children') && data.children instanceof Map;
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
}

const utils = new Utils();
export default utils;