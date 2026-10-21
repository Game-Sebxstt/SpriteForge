/**
 * Point-in-(rotated)-rectangle hit test shared by `Rect` and `Sprite`.
 * The rectangle's origin is its top-left corner `(originX, originY)`; when
 * `rotation` is non-zero the point is transformed into the rectangle's local
 * space before the bounds check. All values are in canvas pixels.
 *
 * @param pointX - X coordinate of the point (e.g. the mouse) in canvas space.
 * @param pointY - Y coordinate of the point in canvas space.
 * @param originX - X coordinate of the rectangle's top-left corner.
 * @param originY - Y coordinate of the rectangle's top-left corner.
 * @param width - Width of the rectangle in pixels.
 * @param height - Height of the rectangle in pixels.
 * @param rotation - Rotation of the rectangle in radians about its origin.
 * @returns `true` if the point lies within the rectangle, otherwise `false`.
 */
export function isPointInRotatedRect(
    pointX: number,
    pointY: number,
    originX: number,
    originY: number,
    width: number,
    height: number,
    rotation: number
): boolean {
    if (rotation === 0) {
        return pointX >= originX &&
               pointX <= originX + width &&
               pointY >= originY &&
               pointY <= originY + height;
    }

    const dx = pointX - originX;
    const dy = pointY - originY;

    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);

    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    return localX >= 0 &&
           localX <= width &&
           localY >= 0 &&
           localY <= height;
}

/**
 * Utility class providing common mathematical and helper functions
 * Contains static methods for random number generation and other utilities
 */
export class Utils {
    /**
     * Generates a random integer between min and max (inclusive)
     * @param min - The minimum value (inclusive)
     * @param max - The maximum value (inclusive)
     * @returns A random integer within the specified range
     */
    static randomInt(min: number, max: number) : number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Generates a random floating-point number between min and max
     * @param min - The minimum value (inclusive)
     * @param max - The maximum value (exclusive)
     * @returns A random float within the specified range
     */
    static randomFloat(min: number, max: number) : number {
        return Math.random() * (max - min) + min;
    }
}