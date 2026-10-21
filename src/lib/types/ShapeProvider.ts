import type { Vector } from "../common/Vector";
import type { Shape } from "../instances/Shape";

export type ShapeEventTemplate = {
    pointer: {
        relative: Vector;
        absolute: Vector;
    },
    target: Shape;
}

export type ShapeEventClick = ShapeEventTemplate;
export type ShapeEventDragStart = ShapeEventTemplate;
export type ShapeEventDragEnd = ShapeEventTemplate;
export type ShapeEventDrag = ShapeEventTemplate;
export type ShapeEventDestroy = ShapeEventTemplate;
export type ShapeEventSelect = ShapeEventTemplate;
export type ShapeEventDeselect = ShapeEventTemplate;
export type ShapeEventPlay = { target: Shape };
export type ShapeEventPause = { target: Shape };

export type ShapeEventsMap = {
    "click": ShapeEventClick;
    "dragstart": ShapeEventDragStart;
    "dragend": ShapeEventDragEnd;
    "drag": ShapeEventDrag;
    "destroy": ShapeEventDestroy;
    "select": ShapeEventSelect;
    "deselect": ShapeEventDeselect;
    "play": ShapeEventPlay;
    "pause": ShapeEventPause;
}

export type ShapeEventsType = keyof ShapeEventsMap;
export type ShapeListenerCallback<T extends ShapeEventsType> = (args?: ShapeEventsMap[T]) => void;
