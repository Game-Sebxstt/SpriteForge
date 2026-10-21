import { Vector } from "./Vector";

/**
 * A real 2D camera (Phase 3 §3.7) replacing the old child-translation "pan".
 *
 * The camera holds a world transform `{ x, y, scale }` applied once per frame via
 * `ctx.setTransform`. Screen (canvas-pixel) coordinates are converted to WORLD
 * coordinates through {@link screenToWorld} so all hit-testing stays correct at
 * any zoom/pan. Panning no longer mutates sprite positions — it only moves the
 * camera (BEHAVIOR CHANGE, flagged in CHANGES).
 *
 * World→screen: `screen = world * scale + offset`.
 * Screen→world: `world = (screen - offset) / scale`.
 */
export class Camera {
    /** Horizontal pan offset in screen pixels. */
    public x: number = 0;
    /** Vertical pan offset in screen pixels. */
    public y: number = 0;
    /** Uniform zoom factor (1 = 100%). */
    public scale: number = 1;

    /** Hard limits so zoom can never invert or explode the transform. */
    public static readonly MIN_SCALE = 0.1;
    public static readonly MAX_SCALE = 10;

    /**
     * Converts a screen (canvas-pixel) point into world space.
     * @param x - Screen x in canvas pixels.
     * @param y - Screen y in canvas pixels.
     * @returns The equivalent world-space vector.
     */
    public screenToWorld(x: number, y: number): Vector {
        return new Vector((x - this.x) / this.scale, (y - this.y) / this.scale);
    }

    /**
     * Converts a world point into screen (canvas-pixel) space.
     * @param x - World x.
     * @param y - World y.
     * @returns The equivalent screen-space vector.
     */
    public worldToScreen(x: number, y: number): Vector {
        return new Vector(x * this.scale + this.x, y * this.scale + this.y);
    }

    /**
     * Zooms toward a screen-space focal point, keeping the world point under the
     * cursor fixed (standard wheel-zoom). Scale is clamped to the camera limits.
     * @param factor - Multiplicative zoom factor (>1 zooms in, <1 zooms out).
     * @param screenX - Focal x in screen pixels.
     * @param screenY - Focal y in screen pixels.
     */
    public zoomAt(factor: number, screenX: number, screenY: number): void {
        const next = Math.max(
            Camera.MIN_SCALE,
            Math.min(Camera.MAX_SCALE, this.scale * factor)
        );
        if (next === this.scale) return;

        // Keep the world point under the cursor stationary across the zoom.
        const worldBefore = this.screenToWorld(screenX, screenY);
        this.scale = next;
        const worldAfter = this.screenToWorld(screenX, screenY);
        this.x += (worldAfter.x - worldBefore.x) * this.scale;
        this.y += (worldAfter.y - worldBefore.y) * this.scale;
    }

    /**
     * Pans the camera by a screen-pixel delta.
     * @param dx - Delta x in screen pixels.
     * @param dy - Delta y in screen pixels.
     */
    public panBy(dx: number, dy: number): void {
        this.x += dx;
        this.y += dy;
    }

    /** Resets the camera to the identity transform. */
    public reset(): void {
        this.x = 0;
        this.y = 0;
        this.scale = 1;
    }
}
