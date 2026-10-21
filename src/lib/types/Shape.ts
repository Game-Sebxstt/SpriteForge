import type { Vector } from "../common/Vector";
import type { SpriteGrid } from "../instances/_shapes/Sprite";

export interface ShapeProps {
    dragging?: boolean;
    position: Vector;
    zIndex?: number;
    rotation?: number;
    visible?: boolean;
}

export interface CircleProps extends ShapeProps {
    radius: number;
    color?: string;
}

export interface RectProps extends ShapeProps {
    width: number;
    height: number;
    color?: string;
    borderWidth?: number;
    borderColor?: string;
}

export interface SpriteProps extends ShapeProps {
    src: string;
    spriteGrid: SpriteGrid;
    ignoreFrames?: number[];
    startFrame?: number;
    endFrame?: number;
    pattern?: string[];
    scale?: number;
    speed?: number;
    loop?: boolean;
    /** Optional per-sprite FPS (Phase 3 §3.3); undefined keeps legacy cadence. */
    fps?: number;
}

export interface ArrowProps extends ShapeProps {
    target: Vector;
    color?: string;
    strokeWidth?: number;
}
