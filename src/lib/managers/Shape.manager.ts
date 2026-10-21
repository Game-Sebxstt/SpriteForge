import { Shape } from "../instances/Shape";
import { BodyVelocity } from "../common/BodyVelocity";
import { Vector } from "../common/Vector";
import { Controller } from "../common/Controller";
import type { ControllerProps } from "../types/Controller";

/**
 * Manager class for handling shape-specific operations and physics
 * Provides utilities for adding physics components like velocity to shapes
 */
export class ShapeManager {
    private _shape: Shape;

    /**
     * Creates a new shape manager for the given shape
     * @param shape - The shape instance to manage
     */
    public constructor(shape: Shape) {
        this._shape = shape;
    }

    /**
     * Adds velocity-based physics to the shape
     * @param direction - The direction vector for movement
     * @param speed - The speed multiplier for movement
     */
    public bodyVelocity(direction: Vector, speed: number): void {
        if (this._shape.bodyVelocity) return;
        this._shape.bodyVelocity = new BodyVelocity({
            direction: direction,
            speed: speed,
            shape: this._shape
        });

        this._shape.render.autoSave();
    }

    /**
     * Adds keyboard control to the shape
     * @param keywords - The keywords for movement (up, down, left, right)
     * @param speed - The speed multiplier for movement
     */
    public controller(props: ControllerProps): void {
        if (this._shape.controller) return;
        const controller = new Controller({
            keywords: props.keywords,
            speed: props.speed,
            status: props.status
        }, this._shape.render);

        this._shape.controller = controller;
        this._shape.render.autoSave();
    }
}