import type {
    RenderEventsType,
    RenderEventMap,
    ListenerCallback,
} from "../types/RenderProvider";

/**
 * Event provider for render-related events with type-safe event handling
 * Manages event listeners for mouse interactions and shape creation events
 */
export class RenderProvider {
    private _listeners: {
        [K in RenderEventsType]: ListenerCallback<K>[]
    } = {
        "click": [],
        "touch": [],
        "mousemove": [],
        "mousedown": [],
        "mouseup": [],
        "touchstart": [],
        "touchmove": [],
        "touchend": [],
        "create": []
    };

    /**
     * Registers an event listener for the specified event type
     * @param event - The event type to listen for
     * @param callback - The callback function to execute when event occurs
     */
    public on<T extends RenderEventsType>(event: T, callback: ListenerCallback<T>): void {
        this._listeners[event].push(callback as ListenerCallback<RenderEventsType>);
    }

    /**
     * Removes an event listener for the specified event type
     * @param event - The event type to remove listener from
     * @param callback - The callback function to remove
     */
    public off<T extends RenderEventsType>(event: T, callback: ListenerCallback<T>): void {
        const listeners = this._listeners[event];
        const index = listeners.indexOf(callback as ListenerCallback<RenderEventsType>);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    /**
     * Emits an event to all registered listeners
     * @param event - The event type to emit
     * @param args - The event arguments to pass to listeners
     */
    public emit<T extends RenderEventsType>(event: T, args: RenderEventMap[T]): void {
        const listeners = this._listeners[event] as ListenerCallback<T>[];
        listeners.forEach((callback) => {
            callback(args);
        });
    }
}