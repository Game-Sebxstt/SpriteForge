import { Shape } from "../instances/Shape";
import { Vector } from "./Vector";
import type { BodyVelocityProps } from "../types/BodyVelocity";

/**
 * Physics component that handles velocity-based movement for shapes
 * Applies directional movement with speed to shape positions each frame
 */
export class BodyVelocity {
    private _shape: Shape | null;
    public direction: Vector | null;
    public speed: number | null;

    /**
     * Creates a new body velocity component for a shape
     * @param props - Configuration containing shape, direction, and speed
     */
    public constructor(props: BodyVelocityProps) {
        this._shape = props.shape ?? null;
        this.direction = props.direction ?? null;
        this.speed = props.speed ?? null;
    }

    /**
     * Updates the shape's position based on direction and speed
     * Called each frame to apply velocity-based movement
     */
    public update() : void {
        if (!this._shape || !this.direction || !this.speed) return;
        this._shape.position.x += this.direction.x * this.speed;
        this._shape.position.y += this.direction.y * this.speed;
    }

    /**
     * Cleans up the velocity component and removes references
     * Detaches from shape and nullifies all properties
     */
    public destroy() : void {
        if (!this._shape) return;
        this._shape.bodyVelocity = null;
        this._shape = null;
        this.direction = null;
        this.speed = null;
    }
}