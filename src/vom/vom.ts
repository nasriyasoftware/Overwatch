import atomix from "@nasriya/atomix";
import Snapshot from "./snapshot";
import eventsManager from "../events/manager";
import path from "path";

class VirtualObjectManager {
    readonly #_snapshots: Map<string, Snapshot> = new Map();
    readonly #_dispatcher = {
        task: () => {
            const snapshots = Array.from(this.#_snapshots.values());
            const activeSnapshots = snapshots.filter(snapshot => !snapshot.isDeleted);
            const deletedSnapshots = snapshots.filter(snapshot => snapshot.isDeleted);

            for (const snapshot of activeSnapshots) {
                snapshot.update();
            }

            for (const snapshot of deletedSnapshots) {
                this.#_snapshots.delete(snapshot.path);
                eventsManager.emit.snapshotRemoved(snapshot);
            }
        },
        job: null as NodeJS.Timeout | null,
        interval: 1000
    }

    readonly #_control = {
        reset: () => {
            if (this.#_dispatcher.job) {
                clearInterval(this.#_dispatcher.job);
                this.#_dispatcher.job = null;
            }
        },
        start: () => {
            this.#_dispatcher.job = setInterval(this.#_dispatcher.task, this.#_dispatcher.interval);
        }
    }

    constructor() {
        this.dispatch();

        eventsManager.on('shutdown', () => {
            this.#_control.reset();
            this.#_snapshots.clear();
        });
    }

    readonly #_helpers = {
        getCoveringSnapshot: (path_: string): Snapshot | undefined => {
            const isWin = atomix.runtime.platform.isWindows();
            let currentPath = path_;

            while (true) {
                const currentCompare = isWin ? currentPath.toLowerCase() : currentPath;

                for (const [snapPath, snapshot] of this.#_snapshots.entries()) {
                    const snapCompare = isWin ? snapPath.toLowerCase() : snapPath;

                    if (snapCompare === currentCompare) {
                        return snapshot;
                    }
                }

                const parent = path.dirname(currentPath);
                if (parent === currentPath) break;
                currentPath = parent;
            }

            return undefined;
        }
    }

    /**
     * Finds the closest parent snapshot of the given path by traversing upward from it.
     * If no parent snapshot is found, creates a new snapshot for the given path.
     * @param path_ The path to find the closest parent snapshot for.
     * @returns A Promise that resolves with the closest parent snapshot of the given path.
     */
    async snapshot(path_: string): Promise<Snapshot> {
        const originalPath = atomix.path.normalizePath(path_);
        const snapshot = this.#_helpers.getCoveringSnapshot(originalPath);

        if (snapshot) {
            if (!snapshot.isProcessing) { await snapshot.update(); }
            return snapshot;
        } else {
            const newSnapshot = new Snapshot(originalPath);
            await newSnapshot.update();
            this.#_snapshots.set(originalPath, newSnapshot);
            return newSnapshot;
        }
    }

    /**
     * Resets the dispatch interval for checking for changes in the virtual object structure.
     * If the dispatch interval is already running, it will be cleared and restarted.
     * The dispatch interval is used to check for changes such as added, removed, or renamed files and directories.
     */
    dispatch() {
        this.#_control.reset();
        this.#_control.start();
    }

    /**
     * The interval (in milliseconds) at which the virtual object structure is checked for changes.
     * This interval is used to check for changes such as added, removed, or renamed files and directories.
     * @returns The interval at which the virtual object structure is checked for changes. Default is 1000ms.
     */
    get dispatchInterval() {
        return this.#_dispatcher.interval;
    }

    /**
     * Sets the interval (in milliseconds) at which the virtual object structure is checked for changes.
     * This interval is used to check for changes such as added, removed, or renamed files and directories.
     * @param ms - The new interval at which the virtual object structure is checked for changes.
     * @throws {Error} If `ms` is not a finite number between 1000ms and 60000ms.
     */
    set dispatchInterval(ms: number) {
        const MIN = 200;      // 200ms
        const MAX = 300_000;  // 5 minutes

        if (!Number.isFinite(ms) || ms < MIN || ms > MAX) {
            throw new RangeError(`dispatchInterval must be between ${MIN}ms and ${MAX}ms`);
        }

        this.#_dispatcher.interval = ms;
        this.dispatch();
    }
}

export default VirtualObjectManager