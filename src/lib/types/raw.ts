import type { Vector } from "../common/Vector";
import type { SpriteGrid } from "../instances/_shapes/Sprite";
import type { ControllerKeyWords, ControllerStatus } from "./Controller";

export type ShapeType = "circle" | "rect" | "sprite" | "arrow" | "pointer" | "controller";

export interface ShapeRawData {
    id: string;
    type: ShapeType;
    position: Vector;
    rotation: number;
    zIndex: number;
    dragging: boolean;
    visible: boolean;
}

export interface CircleRawData extends ShapeRawData {
    radius: number;
    color: string;
}

export interface RectRawData extends ShapeRawData {
    width: number;
    height: number;
    color: string;
    borderWidth: number;
    borderColor: string;
}

export interface SpriteRawData extends ShapeRawData {
    src: string;
    spriteGrid: SpriteGrid;
    ignoreFrames: number[];
    startFrame: number;
    endFrame: number;
    pattern: string[];
    scale: number;
    speed: number;
    loop: boolean;
    /** Optional per-sprite FPS (Phase 3 §3.3); absent keeps legacy cadence. */
    fps?: number;
    controller?: ControllerRawData;
    isPlaying: boolean;
    isDebugged: boolean;
}

export interface ArrowRawData extends ShapeRawData {
    target: Vector;
    color: string;
    strokeWidth: number;
}

export interface ControllerRawData {
    id: string
    type: string
    keywords: ControllerKeyWords
    status: ControllerStatus
    speed?: number
    jumpForce?: number
}
