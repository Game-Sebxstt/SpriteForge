import { Controller } from "@/lib/common/Controller";
import { Render } from "../../Render";
import { Shape } from "../Shape";
import { Vector } from "@/lib/common/Vector";
import { isPointInRotatedRect } from "../../lib/Utils";
import type { SpriteProps } from "../../types/Shape";
import type { SpriteRawData } from "../../types/raw";

export type SpriteGrid = {
    rows: number,
    cols: number
}

export class Sprite extends Shape {
    private _ctx: CanvasRenderingContext2D;
    private _image: HTMLImageElement = new Image();
    private _width: number = 100;
    private _height: number = 100;
    private _widthFrame: number = 100;
    private _heightFrame: number = 100;

    private _running: boolean = true;
    private _paused: boolean = false;
    private _debugged: boolean = false;
    private _loading: boolean = true;
    private _fallbackApplied: boolean = false;
    private _frameIndex: number = 0;
    /**
     * Legacy per-frame duration (ms) used when `fps` is absent, so existing
     * scenes animate at exactly today's cadence (Phase 3 §3.3).
     */
    private _frameDuration: number = 60;
    /**
     * Optional per-sprite frames-per-second. When set, it replaces the fixed
     * `_frameDuration` (frame duration = 1000 / fps). Undefined reproduces the
     * legacy cadence. Persisted as an optional raw field (contract-safe).
     */
    public fps: number | undefined;
    
    private static _globalTime: number = 0;
    private static _lastGlobalUpdate: number = performance.now();
    private _lastFrameUpdate: number = 0;
    
    private _debugText: string = "";
    private _debugTextDirty: boolean = true;
    private _lastDebugUpdate: number = 0;

    public src: string;
    public scale: number;
    public spriteGrid: SpriteGrid;
    public ignoreFrames: number[];
    public startFrame: number;
    public endFrame: number;
    public pattern: string[] | undefined;
    public speed: number | undefined;
    public loop: boolean | undefined;
    
    private _processedFrames: number[] = [];
    private _patternIndex: number = 0;
    private _patternBackup: string[] | undefined;

    /**
     * Onion-skin toggle (Phase 3 §3.4). When enabled, the previous/next frames
     * of the sprite are ghosted at reduced alpha beneath the current frame.
     * View-only state — never persisted.
     */
    private _onionSkin: boolean = false;

    /**
     * Creates a new Sprite instance with animation capabilities
     * @param props - Configuration properties for the sprite
     * @param render - Render context for drawing operations
     */
    public constructor(props: SpriteProps, render: Render, id?: string) {
        super(props, render, id);
        this._ctx = render.ctx;
        this.src = props.src;
        this.spriteGrid = props.spriteGrid ?? { rows: 1, cols: 1 };
        this.ignoreFrames = props.ignoreFrames ?? [];
        this.startFrame = props.startFrame ?? 0;
        this.endFrame = props.endFrame ?? this.spriteGrid.rows * this.spriteGrid.cols - 1;
        this.pattern = props.pattern;
        this._patternBackup = props.pattern;
        this.speed = props.speed ?? 1;
        this.scale = props.scale ?? 1;
        this.loop = props.loop ?? true;
        this.fps = props.fps;
        
        if (this.pattern) {
            this._processedFrames = this._parsePattern(this.pattern);
        }

        this._setup();
    }

    /**
     * Gets the scaled width of a single sprite frame
     * @returns The frame width multiplied by scale factor
     * @private
     */
    private _getWidthFrame() : number {
        return this._widthFrame * this.scale;
    }

    /**
     * Gets the scaled height of a single sprite frame
     * @returns The frame height multiplied by scale factor
     * @private
     */
    private _getHeightFrame() : number {
        return this._heightFrame * this.scale;
    }

    /**
     * Gets the current animation speed multiplier
     * @returns The speed value or default of 1
     * @private
     */
    private _getSpeed() : number {
        return this.speed ?? 1;
    }

    /**
     * Effective per-frame duration in ms (Phase 3 §3.3). When `fps` is set it is
     * derived as `1000 / fps`; otherwise the legacy fixed `_frameDuration` is
     * used so existing scenes animate identically.
     * @returns Frame duration in milliseconds.
     * @private
     */
    private _getFrameDuration() : number {
        if (this.fps && this.fps > 0) return 1000 / this.fps;
        return this._frameDuration;
    }

    /**
     * Sets a per-sprite FPS (Phase 3 §3.3). Pass `undefined` to restore the
     * legacy fixed cadence.
     * @param fps - Target frames per second, or undefined for legacy cadence.
     * @returns This sprite instance for method chaining.
     */
    public setFps(fps: number | undefined) : Sprite {
        this.fps = fps;
        this._render.autoSave();
        return this;
    }

    /**
     * Checks if the sprite intersects with a given boundary rectangle
     * @param boundaryX - X coordinate of the boundary
     * @param boundaryY - Y coordinate of the boundary
     * @param boundaryWidth - Width of the boundary
     * @param boundaryHeight - Height of the boundary
     * @returns True if sprite intersects with boundary, false otherwise
     */
    public _isShapeInBoundary(boundaryX: number, boundaryY: number, boundaryWidth: number, boundaryHeight: number): boolean {
        const spriteWidth = this._getWidthFrame();
        const spriteHeight = this._getHeightFrame();

        return !(this.position.x + spriteWidth < boundaryX || 
            this.position.x > boundaryX + boundaryWidth ||
            this.position.y + spriteHeight < boundaryY || 
            this.position.y > boundaryY + boundaryHeight);
    }

    /**
     * Determines if the sprite is currently being clicked by the mouse
     * Handles both non-rotated and rotated sprite collision detection
     * @returns True if mouse is clicking within sprite bounds, false otherwise
     */
    public _isClicked() : boolean {
        const mouseVector = this._render.mousePositionRelative();
        return isPointInRotatedRect(
            mouseVector.x, mouseVector.y,
            this.position.x, this.position.y,
            this._getWidthFrame(), this._getHeightFrame(),
            this.rotation
        );
    }

    /**
     * Initializes the sprite by loading the image and setting up dimensions
     * Sets up error handling and calculates frame dimensions once loaded
     * @private
     */
    private _setup() : void {
        this._loading = true;

        this._image.onerror = () => {
            if (this._fallbackApplied) {
                // Fallback already attempted (e.g. /logo.png also failed); stop
                // retrying to avoid an infinite load loop and keep the placeholder.
                this._loading = false;
                return;
            }

            this._fallbackApplied = true;
            this.src = "/logo.png";
            this._image.src = this.src;
        };

        this._image.onload = () => {
            // Compute frame dimensions BEFORE the first draw so the sprite renders
            // at the correct frame size on its very first frame.
            this._width = this._image.width;
            this._height = this._image.height;

            this._widthFrame = this._width / this.spriteGrid.cols;
            this._heightFrame = this._height / this.spriteGrid.rows;
            this._loading = false;

            this.draw();
        };

        this._image.src = this.src;
    }
    
    /**
     * Parse pattern array into frame sequence.
     * Each token is exactly one of the following standalone forms:
     * - `"1"`      → frame 1
     * - `"6:12"`   → frames 6,7,8,9,10,11,12 (ascending)
     * - `"12:6"`   → frames 12,11,...,6 (reverse when start > end)
     * - `"6:12^"`  → ping-pong: 6..12 then 11..7 (endpoints not repeated)
     * - `"22:-1"`  → frames 22 to the last frame of the sheet
     * - `"1(5)"`   → frame 1 repeated 5 times
     * - `"2x8"`    → "8 frames starting at 2" → 2,3,4,5,6,7,8,9 (clamped to maxFrame)
     *
     * `x` does not combine with `:` or `(r)`; an invalid combined token (e.g.
     * `"2x8(3)"`) falls back to the legacy single-frame `parseInt` read.
     * All produced frames are clamped to `[0, maxFrame]` where
     * `maxFrame = rows*cols - 1`.
     */
    private _parsePattern(pattern: string[]): number[] {
        const frames: number[] = [];
        const maxFrame = this.spriteGrid.rows * this.spriteGrid.cols - 1;

        const clamp = (n: number): number => Math.max(0, Math.min(n, maxFrame));

        for (const item of pattern) {
            const repeatMatch = item.match(/^(\d+)\((\d+)\)$/);
            const countMatch = item.match(/^(\d+)x(\d+)$/);
            const pingPongMatch = item.match(/^(-?\d+):(-?\d+)\^$/);
            const rangeMatch = item.match(/^(-?\d+):(-?\d+)$/);

            if (repeatMatch) {
                const frameNumber = clamp(parseInt(repeatMatch[1]!, 10));
                const repeatCount = parseInt(repeatMatch[2]!, 10);
                for (let i = 0; i < repeatCount; i++) {
                    frames.push(frameNumber);
                }
            } else if (countMatch) {
                // "NxC" = C frames starting at N, clamped to maxFrame.
                const start = parseInt(countMatch[1]!, 10);
                const count = parseInt(countMatch[2]!, 10);
                if (start > maxFrame) {
                    // Start beyond the sheet resolves to the single last frame.
                    if (count > 0) frames.push(maxFrame);
                } else {
                    // Emit start..end, stopping at maxFrame (no duplicate/wrap):
                    // "2x8" on a 3x3 sheet → [2..8], not [2..8,8].
                    const end = Math.min(start + count - 1, maxFrame);
                    for (let frame = start; frame <= end; frame++) {
                        frames.push(frame);
                    }
                }
            } else if (pingPongMatch) {
                const start = clamp(parseInt(pingPongMatch[1]!, 10));
                const end = pingPongMatch[2] === '-1' ? maxFrame : clamp(parseInt(pingPongMatch[2]!, 10));
                // Forward sweep (inclusive) then backward sweep without repeating endpoints.
                if (start <= end) {
                    for (let i = start; i <= end; i++) frames.push(i);
                    for (let i = end - 1; i > start; i--) frames.push(i);
                } else {
                    for (let i = start; i >= end; i--) frames.push(i);
                    for (let i = end + 1; i < start; i++) frames.push(i);
                }
            } else if (rangeMatch) {
                const start = clamp(parseInt(rangeMatch[1]!, 10));
                const end = rangeMatch[2] === '-1' ? maxFrame : clamp(parseInt(rangeMatch[2]!, 10));
                if (start <= end) {
                    for (let i = start; i <= end; i++) frames.push(i);
                } else {
                    for (let i = start; i >= end; i--) frames.push(i);
                }
            } else {
                frames.push(clamp(parseInt(item, 10)));
            }
        }

        return frames;
    }
    
    /**
     * Updates the global animation timer used for frame synchronization
     * Maintains consistent timing across all sprite instances
     * @private
     * @static
     */
    private static _updateGlobalTime(): void {
        const now = performance.now();
        if (now - Sprite._lastGlobalUpdate > 16) {
            Sprite._globalTime = now;
            Sprite._lastGlobalUpdate = now;
        }
    }

    /**
     * Restores the sprite's pattern to its original state
     * @private
     */
    public _restorePattern() : void {
        if (!this._patternBackup) {
            this.pattern = undefined;
            this._processedFrames = [];
            this._patternIndex = 0;
            return;
        }
        
        this.pattern = this._patternBackup;
        this._processedFrames = this._parsePattern(this._patternBackup);
        this._patternIndex = 0;
    }

    /* ---------------------------------------------------------------------- */
    /* Timeline / onion-skin helpers (Phase 3 §3.4) — view-only, not persisted */
    /* ---------------------------------------------------------------------- */

    /**
     * Number of steps in the current timeline. When a pattern is active this is
     * the resolved frame-sequence length; otherwise it is the sheet frame span
     * `[startFrame, endFrame]`.
     * @returns The number of scrubbable frames (>= 1).
     */
    public getFrameCount(): number {
        if (this._processedFrames.length > 0) return this._processedFrames.length;
        const end = this.endFrame === -1
            ? this.spriteGrid.rows * this.spriteGrid.cols - 1
            : this.endFrame;
        return Math.max(1, end - this.startFrame + 1);
    }

    /**
     * Current timeline index: the pattern index when a pattern is active, else
     * the offset of `_frameIndex` within `[startFrame, endFrame]`.
     * @returns The current scrubber index.
     */
    public getFrameIndex(): number {
        if (this._processedFrames.length > 0) return this._patternIndex;
        return Math.max(0, this._frameIndex - this.startFrame);
    }

    /**
     * Sets the current timeline index (scrubber). Intended for use while paused.
     * The index is clamped to the valid range.
     * @param index - Target timeline index.
     * @returns This sprite instance for method chaining.
     */
    public setFrameIndex(index: number): Sprite {
        const count = this.getFrameCount();
        const clamped = Math.max(0, Math.min(index, count - 1));
        if (this._processedFrames.length > 0) {
            this._patternIndex = clamped;
        } else {
            this._frameIndex = this.startFrame + clamped;
        }
        this._debugTextDirty = true;
        return this;
    }

    /** Whether onion-skinning is enabled for this sprite. */
    public isOnionSkin(): boolean {
        return this._onionSkin;
    }

    /* ---------------------------------------------------------------------- */
    /* Export accessors (Phase 3 §3.1)                                         */
    /* ---------------------------------------------------------------------- */

    /** The underlying sheet image (for sheet PNG export). */
    public getImage(): HTMLImageElement {
        return this._image;
    }

    /** Unscaled source frame dimensions `{ width, height }` in sheet pixels. */
    public getFrameSize(): { width: number; height: number } {
        return { width: this._widthFrame, height: this._heightFrame };
    }

    /**
     * The resolved sequence of sheet frame NUMBERS for the current pattern. When
     * no pattern is active, the `[startFrame, endFrame]` span is returned. Used
     * by the animated exporter.
     * @returns An array of sheet frame numbers (length >= 1).
     */
    public getResolvedFrames(): number[] {
        if (this._processedFrames.length > 0) return [...this._processedFrames];
        const end = this.endFrame === -1
            ? this.spriteGrid.rows * this.spriteGrid.cols - 1
            : this.endFrame;
        const frames: number[] = [];
        for (let f = this.startFrame; f <= end; f++) frames.push(f);
        return frames.length > 0 ? frames : [this.startFrame];
    }

    /**
     * Enables/disables onion-skinning (ghosting of neighboring frames).
     * @param enabled - True to show ghost frames.
     * @returns This sprite instance for method chaining.
     */
    public setOnionSkin(enabled: boolean): Sprite {
        this._onionSkin = enabled;
        return this;
    }

    /**
     * Resolves a timeline index to the underlying sheet frame number.
     * @param index - Timeline index.
     * @returns The sheet frame number for that index.
     * @private
     */
    private _resolveFrameAt(index: number): number {
        if (this._processedFrames.length > 0) {
            return this._processedFrames[index] ?? this._processedFrames[0] ?? 0;
        }
        return this.startFrame + index;
    }

    /**
     * Draws a single sheet frame at the sprite's transform with the given alpha.
     * Used to render onion-skin ghosts of neighboring frames.
     * @param frameNumber - The sheet frame number to draw.
     * @param alpha - Global alpha for the ghost (0..1).
     * @private
     */
    private _drawGhostFrame(frameNumber: number, alpha: number): void {
        const maxFrame = this.spriteGrid.rows * this.spriteGrid.cols - 1;
        const frame = Math.max(0, Math.min(frameNumber, maxFrame));
        const currentCol = frame % this.spriteGrid.cols;
        const currentRow = Math.floor(frame / this.spriteGrid.cols);
        const sourceX = currentCol * this._widthFrame;
        const sourceY = currentRow * this._heightFrame;

        this._ctx.save();
        this._ctx.globalAlpha = alpha;
        this._ctx.translate(this.position.x, this.position.y);
        this._ctx.rotate(this.rotation);
        this._ctx.drawImage(
            this._image,
            sourceX, sourceY,
            this._widthFrame, this._heightFrame,
            0, 0,
            this._getWidthFrame(), this._getHeightFrame()
        );
        this._ctx.restore();
    }

    /**
     * Gets the current scaled width of the sprite
     * @returns The sprite width including scale factor
     */
    public getWidth(): number {
        return this._getWidthFrame();
    }

    /**
     * Gets the current scaled height of the sprite
     * @returns The sprite height including scale factor
     */
    public getHeight(): number {
        return this._getHeightFrame();
    }

    /**
     * Sets the sprite width by calculating appropriate scale factor
     * @param width - The desired width in pixels
     * @returns This sprite instance for method chaining
     */
    public setWidth(width: number): Sprite {
        this._width = width;
        this.scale = width / this._widthFrame;
        this._render.autoSave();
        return this;
    }

    /**
     * Sets the sprite height by calculating appropriate scale factor
     * @param height - The desired height in pixels
     * @returns This sprite instance for method chaining
     */
    public setHeight(height: number): Sprite {
        this._height = height;
        this.scale = height / this._heightFrame;
        this._render.autoSave();
        return this;
    }

    /**
     * Enables or disables debug visualization for the sprite
     * Shows frame boundaries, frame index, and speed when enabled
     * @param debugged - True to enable debug mode, false to disable
     * @returns This sprite instance for method chaining
     */
    public setDebug(debugged: boolean): Sprite {
        this._debugged = debugged;
        this._render.autoSave();
        return this;
    }

    /**
     * Sets the animation speed multiplier
     * @param speed - Speed multiplier (1 = normal, 2 = double speed, 0.5 = half speed)
     * @returns This sprite instance for method chaining
     */
    public setSpeed(speed: number): Sprite {
        this.speed = speed;
        this._render.autoSave();
        return this;
    }

    /**
     * Sets whether the animation should loop continuously
     * @param loop - True to loop animation, false to play once and stop
     * @returns This sprite instance for method chaining
     */
    public setLoop(loop: boolean): Sprite {
        this.loop = loop;
        this._render.autoSave();
        return this;
    }

    /**
     * Pauses the sprite animation
     * @returns This sprite instance for method chaining
     */
    public pause(): Sprite {
        this._paused = true;
        this.emit("pause", { target: this });
        this._render.autoSave();
        return this;
    }

    /**
     * Resumes or starts the sprite animation
     * @returns This sprite instance for method chaining
     */
    public play(pattern?: string[]): Sprite {
        this._paused = false;
        if (pattern) {
            this.pattern = pattern;
            this._processedFrames = this._parsePattern(pattern);
            this._patternIndex = 0;
        }
        this.emit("play", { target: this });
        this._render.autoSave();
        return this;
    }

    /**
     * Checks if the sprite animation is currently playing
     * @returns True if animation is running and not paused, false otherwise
     */
    public isPlaying(): boolean {
        return !this._paused;
    }

    /**
     * Checks if debug mode is currently enabled
     * @returns True if debug visualization is active, false otherwise
     */
    public isDebugging(): boolean {
        return this._debugged;
    }

    /**
     * Gets the current debug state
     * @returns True if debug mode is enabled, false otherwise
     */
    public get debug(): boolean {
        return this._debugged;
    }

    /**
     * Renders the current sprite frame to the canvas
     * Handles animation timing, frame progression, pattern sequences,
     * debug visualization, and applies transformations (rotation, position)
     */
    public override draw(): void {
        if (!this._running || !this.visible) return;

        Sprite._updateGlobalTime();

        let actualFrameIndex: number;
        
        if (this._processedFrames.length > 0) {
            actualFrameIndex = this._processedFrames[this._patternIndex] ?? this._processedFrames[0] ?? 0;
        } else {
            if (this.endFrame == -1) {
                this.endFrame = this.spriteGrid.rows * this.spriteGrid.cols - 1;
            }

            if (this.ignoreFrames.length > 0) {
                while (this.ignoreFrames.includes(this._frameIndex)) {
                    this._frameIndex++;
                    if (this._frameIndex > this.endFrame) {
                        this._frameIndex = this.startFrame;
                        break;
                    }
                }
            }
            actualFrameIndex = this._frameIndex;
        }
        
        const currentCol = actualFrameIndex % this.spriteGrid.cols;
        const currentRow = Math.floor(actualFrameIndex / this.spriteGrid.cols);
        
        const sourceX = currentCol * this._widthFrame;
        const sourceY = currentRow * this._heightFrame;

        // Onion-skin ghosts of the neighboring timeline frames (Phase 3 §3.4),
        // drawn beneath the current frame at reduced alpha.
        if (this._onionSkin) {
            const index = this.getFrameIndex();
            const count = this.getFrameCount();
            if (index - 1 >= 0) {
                this._drawGhostFrame(this._resolveFrameAt(index - 1), 0.25);
            }
            if (index + 1 < count) {
                this._drawGhostFrame(this._resolveFrameAt(index + 1), 0.25);
            }
        }

        this._ctx.save();
        this._ctx.translate(this.position.x, this.position.y);
        this._ctx.rotate(this.rotation);

        if (this._debugged) {
            this._ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
            this._ctx.fillRect(0, 0, this._getWidthFrame(), this._getHeightFrame());
            this._ctx.strokeStyle = "red";
            this._ctx.lineWidth = 1;
            this._ctx.strokeRect(0, 0, this._getWidthFrame(), this._getHeightFrame());
            
            if (this._debugTextDirty || Sprite._globalTime - this._lastDebugUpdate > 166) {
                this._debugText = `F:${actualFrameIndex} S:${this._getSpeed()}x`;
                this._debugTextDirty = false;
                this._lastDebugUpdate = Sprite._globalTime;
            }
            
            this._ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            this._ctx.fillRect(0, -20, 80, 18);
            this._ctx.fillStyle = "white";
            this._ctx.font = "12px Arial";
            this._ctx.fillText(this._debugText, 2, -6);
        }

        this._ctx.drawImage(
            this._image,
            sourceX, sourceY,
            this._widthFrame, this._heightFrame,
            0, 0,
            this._getWidthFrame(), this._getHeightFrame()
        );

        this._ctx.restore();

        if (this.isPlaying() && Sprite._globalTime - this._lastFrameUpdate >= this._getFrameDuration() / this._getSpeed()) {
            this._lastFrameUpdate = Sprite._globalTime;
            this._debugTextDirty = true;

            if (this._processedFrames.length > 0) {
                this._patternIndex++;
                if (this._patternIndex >= this._processedFrames.length) {
                    if (!this.loop) this.pause();
                    this._patternIndex = 0;
                }
            } else {
                this._frameIndex++;
                if (this._frameIndex > this.endFrame) {
                    if (!this.loop) this.pause();
                    this._frameIndex = this.startFrame;
                }
            }
        }
    }

    /**
     * Updates the sprite state and renders it
     * Shows loading placeholder if image is still loading,
     * otherwise calls parent update and draws the sprite
     */
    public override update(): void {
        if (this._loading) {
            this._ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
            this._ctx.fillRect(this.position.x, this.position.y, this._getWidthFrame(), this._getHeightFrame());
            return;
        }

        super.update();
        this.draw();
    }

    /**
     * Creates a deep copy of this sprite with identical properties
     * @returns A new Sprite instance with the same configuration
     */
    public clone() : Sprite {
        return this._render.creator.Sprite({
            position: this.position.clone(),
            src: this.src,
            spriteGrid: this.spriteGrid,
            ignoreFrames: this.ignoreFrames,
            startFrame: this.startFrame,
            endFrame: this.endFrame,
            pattern: this.pattern,
            speed: this.speed,
            loop: this.loop,
            scale: this.scale,
            fps: this.fps,
            zIndex: this.zIndex,
            rotation: this.rotation,
            visible: this.visible
        });
    }

    /**
     * @internal
     * Returns the raw data of the sprite.
     * @returns The raw data of the sprite.
     */
    public override _rawData() : SpriteRawData {
        const raw: SpriteRawData = {
            id: this.id,
            type: "sprite",
            position: this.position,
            rotation: this.rotation,
            zIndex: this.zIndex,
            dragging: this.dragging,
            visible: this.visible,
            src: this.src,
            spriteGrid: this.spriteGrid,
            ignoreFrames: this.ignoreFrames,
            startFrame: this.startFrame,
            endFrame: this.endFrame,
            pattern: this._patternBackup ?? [],
            speed: this.speed ?? 1,
            loop: this.loop ?? false,
            scale: this.scale ?? 1,
            controller: this.controller?._rawData(),
            isPlaying: this.isPlaying(),
            isDebugged: this.isDebugging()
        };
        // Only persist fps when set so old blobs (no fps) round-trip unchanged.
        if (this.fps !== undefined) raw.fps = this.fps;
        return raw;
    }

    /**
     * @internal
     * Creates a new sprite instance from raw data.
     * @param data - The raw data of the sprite.
     * @returns A new `Sprite` instance with identical properties.
     */
    public static override _fromRawData(data: SpriteRawData, render: Render) : Sprite {
        const sprite = new Sprite(data, render, data.id);
        sprite.src = data.src;
        sprite.spriteGrid = data.spriteGrid;
        sprite.ignoreFrames = data.ignoreFrames;
        sprite.startFrame = data.startFrame;
        sprite.endFrame = data.endFrame;
        sprite.pattern = data.pattern;
        sprite.scale = data.scale;
        sprite.speed = data.speed;
        sprite.loop = data.loop;
        sprite.fps = data.fps;
        sprite.position = new Vector(data.position.x, data.position.y);
        sprite.rotation = data.rotation;
        sprite.zIndex = data.zIndex;
        sprite.dragging = data.dragging;
        sprite.visible = data.visible;

        if (data.controller) {
            sprite.controller = Controller._fromRawData(data.controller, render);
        }

        sprite.setDebug(data.isDebugged);
        render.emit("create", { shape: sprite });
        
        if (data.isPlaying) sprite.play();
        else sprite.pause();
        
        return sprite;
    }
}