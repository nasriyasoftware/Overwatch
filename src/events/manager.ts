import EventEmitter from "events";
import { AddEvent, RemoveEvent, RenameEvent, UpdateEvent } from "../docs/docs";
import Snapshot from "../vom/snapshot";

class EventsManager {
    readonly #_emitter = new EventEmitter();

    readonly emit = {
        /**
         * Emits an `update` event with the specified UpdateEvent.
         * @param event - The `UpdateEvent` to emit.
         */
        update: (event: UpdateEvent) => {
            this.#_emitter.emit('update', event);
        },

        /**
         * Emits a `remove` event with the specified RemoveEvent.
         * @param event - The `RemoveEvent` to emit.
         */
        remove: (event: RemoveEvent) => {
            this.#_emitter.emit('remove', event);
        },

        /**
         * Emits a `rename` event with the specified RenameEvent.
         * @param event - The `RenameEvent` to emit.
         */
        rename: (event: RenameEvent) => {
            this.#_emitter.emit('renamed', event);
        },

        /**
         * Emits an `add` event with the specified AddEvent.
         * @param event - The `AddEvent` to emit.
         */
        add: (event: AddEvent) => {
            this.#_emitter.emit('add', event);
        },

        /**
         * Emits a `snapshotRemoved` event with the specified Snapshot.
         * This event is emitted whenever a Snapshot is removed from the VirtualObjectManager.
         * @param snapshot - The Snapshot that was removed.
         */
        snapshotRemoved: (snapshot: Snapshot) => {
            this.#_emitter.emit('snapshotRemoved', snapshot);
        },

        /**
         * Emits an `overwatch:shutdown` event, which is emitted whenever Overwatch is
         * shut down.
         */
        shutdown: () => {
            this.#_emitter.emit('shutdown');
        }
    }

    on(event: 'update', listener: (event: UpdateEvent) => void): void;
    on(event: 'remove', listener: (event: RemoveEvent) => void): void;
    on(event: 'renamed', listener: (event: RenameEvent) => void): void;
    on(event: 'add', listener: (event: AddEvent) => void): void;
    on(event: 'snapshotRemoved', listener: (snapshot: Snapshot) => void): void;
    on(event: 'shutdown', listener: () => void): void;

    /**
     * Attaches a listener to the specified event. The listener will be called with
     * the emitted event as its only argument.
     * @param event - The name of the event to listen for.
     * @param listener - The listener to attach. The listener will be called with the
     * emitted event as its only argument.
     */
    on(event: string, listener: (event: any) => void): void {
        if (!['update', 'remove', 'renamed', 'add', 'snapshotRemoved', 'shutdown'].includes(event)) { throw new Error(`Invalid event name: ${event}`); }
        this.#_emitter.on(event, listener);
    }
}

const eventsManager = new EventsManager();
export default eventsManager;