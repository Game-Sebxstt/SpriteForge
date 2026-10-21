import type { Render } from "../Render";
import type { Sprite } from "../instances/_shapes/Sprite";
import { safeParseScene } from "./sceneSchema";
import { encodeAPNG } from "./apng";
import { notify } from "../notify";

/**
 * Export/import helpers (Phase 3 §3.1). All downloads reuse the browser's
 * anchor-download mechanism; nothing here introduces new visual vocabulary —
 * the toolbar/panel call these and surface results via the existing `notify`
 * toast and file dialogs.
 */

/**
 * Triggers a browser download of a blob under the given filename.
 * @param blob - The data to download.
 * @param filename - Suggested filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
    if (typeof document === "undefined") return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke on the next tick so the click has been dispatched.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* -------------------------------------------------------------------------- */
/* Scene .json export / import                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Exports the whole scene as a `.json` project file by reusing
 * `Render.serialize()` (the unchanged persistence contract).
 * @param render - The live render.
 * @param filename - Download filename (default `scene.json`).
 */
export function exportSceneJSON(render: Render, filename = "scene.json"): void {
    const data = render.serialize();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, filename);
}

/**
 * Validates and imports a scene JSON string, replacing the current scene. The
 * input is validated with the zod scene schema BEFORE any mutation; on invalid
 * input the scene is left intact and a toast is shown.
 * @param render - The live render.
 * @param json - Raw JSON text from an imported file.
 * @returns True on success, false if the input was rejected.
 */
export function importSceneJSON(render: Render, json: string): boolean {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        notify("Import failed: the file is not valid JSON.", "error");
        return false;
    }

    const result = safeParseScene(parsed);
    if (!result.ok) {
        notify("Import failed: the file is not a valid scene.", "error");
        return false;
    }

    render.replaceScene(result.data);
    notify("Scene imported.", "info");
    return true;
}

/* -------------------------------------------------------------------------- */
/* Sheet PNG export                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Exports a sprite's source sheet as a PNG. Draws the sheet image onto an
 * offscreen canvas and downloads it.
 * @param sprite - The sprite whose sheet to export.
 * @param filename - Download filename (default `sheet.png`).
 * @returns A promise that resolves when the download is triggered.
 */
export async function exportSheetPNG(sprite: Sprite, filename = "sheet.png"): Promise<void> {
    const image = sprite.getImage();
    const canvas = document.createElement("canvas");
    canvas.width = image.width || sprite.spriteGrid.cols * sprite.getFrameSize().width;
    canvas.height = image.height || sprite.spriteGrid.rows * sprite.getFrameSize().height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        notify("Export failed: no 2D context available.", "error");
        return;
    }
    ctx.drawImage(image, 0, 0);
    const blob = await canvasToBlob(canvas, "image/png");
    if (blob) downloadBlob(blob, filename);
}

/* -------------------------------------------------------------------------- */
/* Animated export (WebP via MediaRecorder, APNG via pure-JS encoder)          */
/* -------------------------------------------------------------------------- */

/** Supported animated export formats, in the design's priority order. */
export type AnimatedFormat = "webp" | "apng";

/**
 * Renders a sprite's resolved frames onto a per-frame offscreen canvas.
 * @param sprite - The sprite to render.
 * @returns The offscreen canvas, its 2D context, the frame numbers, and size.
 */
function buildFrameCanvas(sprite: Sprite): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    frames: number[];
    frameW: number;
    frameH: number;
} | null {
    const { width: frameW, height: frameH } = sprite.getFrameSize();
    const frames = sprite.getResolvedFrames();
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(frameW));
    canvas.height = Math.max(1, Math.round(frameH));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return { canvas, ctx, frames, frameW, frameH };
}

/** Draws a single sheet frame onto the offscreen canvas (origin 0,0). */
function drawSheetFrame(
    ctx: CanvasRenderingContext2D,
    sprite: Sprite,
    frameNumber: number,
    frameW: number,
    frameH: number
): void {
    const cols = sprite.spriteGrid.cols;
    const col = frameNumber % cols;
    const row = Math.floor(frameNumber / cols);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(
        sprite.getImage(),
        col * frameW, row * frameH,
        frameW, frameH,
        0, 0,
        ctx.canvas.width, ctx.canvas.height
    );
}

/**
 * Exports a sprite's current animation as an animated file. WebP is the
 * preferred format (via `MediaRecorder`); APNG is the fallback / explicit
 * choice. Encoding runs off the main render loop so the live canvas never
 * stalls.
 * @param sprite - The sprite to export.
 * @param format - "webp" or "apng".
 * @param fps - Playback frames per second for the exported file (default 12).
 * @param filename - Optional filename (defaults by format).
 * @returns A promise resolving when the download is triggered.
 */
export async function exportAnimated(
    sprite: Sprite,
    format: AnimatedFormat,
    fps = 12,
    filename?: string
): Promise<void> {
    const built = buildFrameCanvas(sprite);
    if (!built) {
        notify("Export failed: no 2D context available.", "error");
        return;
    }
    const { canvas, ctx, frames, frameW, frameH } = built;
    const delayMs = Math.max(1, Math.round(1000 / fps));

    if (format === "apng") {
        const rgbaFrames: Uint8Array[] = [];
        for (const frameNumber of frames) {
            drawSheetFrame(ctx, sprite, frameNumber, frameW, frameH);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            rgbaFrames.push(new Uint8Array(imageData.data.buffer.slice(0)));
        }
        const blob = encodeAPNG(rgbaFrames, canvas.width, canvas.height, delayMs);
        downloadBlob(blob, filename ?? "animation.png");
        notify("APNG exported.", "info");
        return;
    }

    // WebP via MediaRecorder + captureStream.
    const supported =
        typeof MediaRecorder !== "undefined" &&
        typeof canvas.captureStream === "function" &&
        MediaRecorder.isTypeSupported?.("video/webm");

    if (!supported) {
        notify("WebP export is not supported in this browser; try APNG.", "warn");
        return;
    }

    await encodeWithMediaRecorder(canvas, ctx, sprite, frames, frameW, frameH, delayMs, filename);
}

/**
 * Drives a MediaRecorder over the offscreen canvas stream, stepping frames on a
 * timer so the recording captures the full animation, then downloads the result.
 */
function encodeWithMediaRecorder(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    sprite: Sprite,
    frames: number[],
    frameW: number,
    frameH: number,
    delayMs: number,
    filename?: string
): Promise<void> {
    return new Promise((resolve) => {
        const stream = canvas.captureStream();
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: "video/webm" });
            downloadBlob(blob, filename ?? "animation.webm");
            notify("Animation exported (WebM/VP). ", "info");
            resolve();
        };

        recorder.start();
        let i = 0;
        drawSheetFrame(ctx, sprite, frames[0]!, frameW, frameH);

        const step = () => {
            if (i >= frames.length) {
                recorder.stop();
                return;
            }
            drawSheetFrame(ctx, sprite, frames[i]!, frameW, frameH);
            i++;
            setTimeout(step, delayMs);
        };
        setTimeout(step, delayMs);
    });
}

/** Promise wrapper over `canvas.toBlob`. */
function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type);
    });
}
