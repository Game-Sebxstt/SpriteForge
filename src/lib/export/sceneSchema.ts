import { z } from "zod";
import type { ShapeRawData } from "../types/raw";

/**
 * Zod schema mirroring the on-disk `ShapeRawData[]` serialization contract
 * (see `src/lib/types/raw.ts`). Used to validate imported scene/project files
 * BEFORE they are handed to `Render.deserialize`, so a malformed or hostile
 * file is rejected without mutating the live scene.
 *
 * The schema is intentionally permissive about extra keys (passthrough) and only
 * enforces the fields `_fromRawData` actually reads, matching the
 * "only add optional fields with safe defaults" serialization rule.
 */

const vectorSchema = z
    .object({
        x: z.number(),
        y: z.number(),
    })
    .passthrough();

const baseShape = {
    id: z.string(),
    position: vectorSchema,
    rotation: z.number(),
    zIndex: z.number(),
    dragging: z.boolean(),
    visible: z.boolean(),
};

const spriteGridSchema = z.object({
    rows: z.number(),
    cols: z.number(),
});

const controllerKeywordsSchema = z.object({
    up: z.string(),
    down: z.string(),
    left: z.string(),
    right: z.string(),
    jump: z.string(),
});

const controllerStatusSchema = z.object({
    up: z.array(z.string()),
    down: z.array(z.string()),
    left: z.array(z.string()),
    right: z.array(z.string()),
    jump: z.array(z.string()),
    fall: z.array(z.string()),
    idle: z.array(z.string()),
});

const controllerRawSchema = z
    .object({
        id: z.string(),
        type: z.string(),
        keywords: controllerKeywordsSchema,
        status: controllerStatusSchema,
        speed: z.number().optional(),
        jumpForce: z.number().optional(),
    })
    .passthrough();

const circleSchema = z
    .object({
        ...baseShape,
        type: z.literal("circle"),
        radius: z.number(),
        color: z.string(),
    })
    .passthrough();

const rectSchema = z
    .object({
        ...baseShape,
        type: z.literal("rect"),
        width: z.number(),
        height: z.number(),
        color: z.string(),
        borderWidth: z.number(),
        borderColor: z.string(),
    })
    .passthrough();

const arrowSchema = z
    .object({
        ...baseShape,
        type: z.literal("arrow"),
        target: vectorSchema,
        color: z.string(),
        strokeWidth: z.number(),
    })
    .passthrough();

const spriteSchema = z
    .object({
        ...baseShape,
        type: z.literal("sprite"),
        src: z.string(),
        spriteGrid: spriteGridSchema,
        ignoreFrames: z.array(z.number()),
        startFrame: z.number(),
        endFrame: z.number(),
        pattern: z.array(z.string()),
        scale: z.number(),
        speed: z.number(),
        loop: z.boolean(),
        // fps is an optional Phase-3 field; absence reproduces legacy cadence.
        fps: z.number().optional(),
        controller: controllerRawSchema.optional(),
        isPlaying: z.boolean(),
        isDebugged: z.boolean(),
    })
    .passthrough();

/** A single serialized shape. Unknown `type`s are rejected. */
export const shapeRawSchema = z.discriminatedUnion("type", [
    circleSchema,
    rectSchema,
    arrowSchema,
    spriteSchema,
]);

/** The scene is an array of serialized shapes — the `localStorage["canvas"]` shape. */
export const sceneSchema = z.array(shapeRawSchema);

/**
 * Validates arbitrary parsed JSON as a scene (`ShapeRawData[]`).
 * @param data - Parsed JSON (e.g. from an imported file).
 * @returns The validated, typed scene array.
 * @throws {z.ZodError} when the data does not match the scene contract.
 */
export function parseScene(data: unknown): ShapeRawData[] {
    return sceneSchema.parse(data) as unknown as ShapeRawData[];
}

/**
 * Non-throwing scene validation.
 * @param data - Parsed JSON to validate.
 * @returns A discriminated result with either the typed scene or the error.
 */
export function safeParseScene(
    data: unknown
): { ok: true; data: ShapeRawData[] } | { ok: false; error: z.ZodError } {
    const result = sceneSchema.safeParse(data);
    if (result.success) {
        return { ok: true, data: result.data as unknown as ShapeRawData[] };
    }
    return { ok: false, error: result.error };
}
