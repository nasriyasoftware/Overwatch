export interface WatchOptions {
    include?: (RegExp | string)[];
    exclude?: (RegExp | string)[];
    onChange?: onWatchedDataChangeHandler;
    onUpdate?: OnWatchedDataUpdateHandler;
    onRemove?: onWatchedDataRemoveHandler;
    onRename?: onWatchedDataRenameHandler;
    onAdd?: onWatchedDataAddHandler;
    onRootRemoved?: () => any | Promise<any>;
}

export type OnWatchedDataUpdateHandler = (event: UpdateEvent) => any | Promise<any>;
export type onWatchedDataRemoveHandler = (event: RemoveEvent) => any | Promise<any>;
export type onWatchedDataRenameHandler = (event: RenameEvent) => any | Promise<any>;
export type onWatchedDataAddHandler = (event: AddEvent) => any | Promise<any>;

export type WatchedDataChangeEvent =
    | { type: 'update'; event: UpdateEvent }
    | { type: 'remove'; event: RemoveEvent }
    | { type: 'rename'; event: RenameEvent }
    | { type: 'add'; event: AddEvent }
    | { type: 'rootRemoved' };

export type onWatchedDataChangeHandler = (change: WatchedDataChangeEvent) => any | Promise<any>;

export interface RenameEvent extends ChangeEventBase {
    oldPath: string,
    newPath: string
}

export interface UpdateEvent extends ChangeEventBase {
    path: string
}

export interface RemoveEvent extends ChangeEventBase {
    path: string
}

export interface AddEvent extends ChangeEventBase {
    path: string
}

export type ChangeEvent = UpdateEvent | RemoveEvent | RenameEvent | AddEvent;


interface ChangeEventBase {
    /**
     * The type of the event.
     * @example 'File'
     * @default 'File'
     */
    type: 'File' | 'Folder',
}

export interface WatchedFile {
    /**
     * The path of the file.
     * @example '/path/to/file.txt'
     */
    path: string;

    /**
     * The name of the file.
     * @example 'file.txt'
     */
    name: string;

    /**
     * The size of the file in bytes.
     * @example 1024
     */
    size: number;

    /**
     * The last modified time of the file.
     * @example '2021-01-01T00:00:00.000Z'
     */
    mTime: Date;
}

export interface WatchedFolder {
    /**
     * The path of the folder.
     * @example '/path/to/folder'
     */
    path: string;

    /**
     * The name of the folder.
     * @example 'folder'
     */
    name: string;

    /**
     * The size of the folder in bytes.
     * @example 1024
     */
    size: number;

    /**
     * The last modified time of the folder.
     * @example '2021-01-01T00:00:00.000Z'
     */
    mTime: Date;

    /**
     * The children of the folder.
     * @example { 'file.txt': { path: '/path/to/file.txt', name: 'file.txt', size: 1024, mTime: '2021-01-01T00:00:00.000Z' } }
     */
    children: Map<string, WatchedData>;
}

export type WatchedData = WatchedFile | WatchedFolder;