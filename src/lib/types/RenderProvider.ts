import type { Vector } from "../common/Vector";
import type { Shape } from "../instances/Shape";
import type { Render } from "../Render";

export type RenderEventTemplate = {
    pointer: {
        relative: Vector;
        absolute: Vector;
    },
    target: Shape | Render;
}

export type RenderEventClick = RenderEventTemplate;
export type RenderEventTouched = RenderEventTemplate;
export type RenderEventMouseMove = RenderEventTemplate;
export type RenderEventMouseDown = RenderEventTemplate;
export type RenderEventMouseUp = RenderEventTemplate;
export type RenderEventTouchStart = RenderEventTemplate;
export type RenderEventTouchMove = RenderEventTemplate;
export type RenderEventTouchEnd = RenderEventTemplate;
export type RenderEventCreate = { shape: Shape };

export type RenderEventMap = {
    "click": RenderEventClick;
    "touch": RenderEventTouched;
    "mousemove": RenderEventMouseMove;
    "mousedown": RenderEventMouseDown;
    "mouseup": RenderEventMouseUp;
    "touchstart": RenderEventTouchStart;
    "touchmove": RenderEventTouchMove;
    "touchend": RenderEventTouchEnd;
    "create": RenderEventCreate;
}

export type RenderEventsType = keyof RenderEventMap;
export type ListenerCallback<T extends RenderEventsType> = (args: RenderEventMap[T]) => void;
