import type { Vector } from "../common/Vector";
import type { Shape } from "../instances/Shape";

export interface BodyVelocityProps {
    shape: Shape;
    direction: Vector;
    speed: number;
}
