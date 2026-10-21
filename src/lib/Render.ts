import { Vector } from "./common/Vector";
import { RenderCreator } from "./helpers/Render.creator";
import { Shape } from "./instances/Shape";
import { RenderManager } from "./managers/Render.manager";
import { Transformer } from "./common/Transformer";
import { Rect } from "./instances/_shapes/Rect";
import { RenderProvider } from "./providers/Render.provider";
import { Controller } from "./common/Controller";
import { Circle } from "./instances/_shapes/Circle";
import { Sprite } from "./instances/_shapes/Sprite";
import { Arrow } from "./instances/_shapes/Arrow";
import { Pointer } from "./instances/_shapes/Pointer";
import { notify } from "./notify";
import { ProjectStore } from "./store/ProjectStore";
import { Camera } from "./common/Camera";
import { History } from "./common/History";
import type { SocketEvents, Collaborator } from "./types/Render";
import type {
    ShapeRawData,
    CircleRawData,
    RectRawData,
    SpriteRawData,
    ArrowRawData,
} from "./types/raw";

/**
 * Main rendering engine for canvas-based 2D graphics and shape management
 * Handles canvas operations, event management, shape rendering, and animation loops
 */
export class Render extends RenderProvider {
    public canvas: HTMLCanvasElement;
    public ctx: CanvasRenderingContext2D;

    public childrens: Map<string, Shape> = new Map();
    public currentUser: { email: string } | null = null;
    public collaborators: Map<string, Shape> = new Map();
    public _controllers: Map<string, Controller> = new Map();
    public _transformer: Transformer | null = null;

    private _backgroundImage: HTMLImageElement = new Image();
    private _backgroundImageLoaded: boolean = false;

    private _mouseVector: Vector = new Vector(0, 0);
    private _target: Shape | this = this;
    private _frameId: number | null = null;
    private _resizeBind: () => void = this.resize.bind(this);
    private _tickBind: () => void = this._tick.bind(this);
    private _onClickedBind: (event: MouseEvent) => void = this._onClicked.bind(this);
    private _onTouchStartBind: (event: TouchEvent) => void = this._onTouchStart.bind(this);
    private _onTouchMoveBind: (event: TouchEvent) => void = this._onTouchMove.bind(this);
    private _onTouchEndBind: (event: TouchEvent) => void = this._onTouchEnd.bind(this);
    private _onMouseMoveBind: (event: MouseEvent) => void = this._onMouseMove.bind(this);
    private _onMouseDownBind: (event: MouseEvent) => void = this._onMouseDown.bind(this);
    private _onMouseUpBind: (event: MouseEvent) => void = this._onMouseUp.bind(this);

    private _onContextMenuBind: (event: MouseEvent) => void = this._onContextMenu.bind(this);

    private _onSocketMouseMoveBind: (event: SocketEvents["user:mousemove"]) => void = this._onSocketMouseMove.bind(this);
    private _onSocketCollaboratorBind: (event: SocketEvents["user:collaborator"]) => void = this._onSocketCollaborator.bind(this);

    /** Timer id for the trailing/max-wait autosave throttle. */
    private _saveTimeout: ReturnType<typeof setTimeout> | null = null;
    /** Whether a save has been requested since the last flush. */
    private _savePending: boolean = false;
    /** Max-wait window (ms) for the autosave throttle. */
    private _saveMaxWait: number = 500;

    /** Real zoom/pan camera (Phase 3 §3.7); replaces the old child-translation pan. */
    public camera: Camera = new Camera();
    /** Whether a middle-button camera pan is in progress. */
    private _isPanning: boolean = false;
    /** Screen-pixel anchor for the active camera pan. */
    private _panAnchor: Vector | null = null;
    /** Bound wheel handler for camera zoom. */
    private _onWheelBind: (event: WheelEvent) => void = this._onWheel.bind(this);

    /** Undo/redo command history (Phase 3 §3.6); in-memory only. */
    public history: History = new History();

    private _isTouched: boolean = false;
    
    private _boundary: Rect | null = null;
    private _boundaryStart: Vector | null = null;
    private _isSelecting: boolean = false;
    private _allowSelect: boolean = true;

    private _fps: number = 0;
    private _lastFrameTime: number = performance.now();
    private _frameCount: number = 0;

    /** Cached z-order-sorted child array; rebuilt only when invalidated. */
    private _sortedChildsCache: Shape[] | null = null;
    /** Snapshot of the last-seen zIndex values, to detect zIndex changes. */
    private _lastZIndexSignature: string = "";

    public _selectedNodes: Shape[] = [];

    public creator: RenderCreator;
    public manager: RenderManager;

    /**
     * Creates a new render instance for the given canvas element
     * @param canvas - The HTML canvas element to render to
     */
    public constructor(canvas: HTMLCanvasElement) {
        super();
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d")!;
        this.creator = new RenderCreator(this);
        this.manager = new RenderManager(this);

        this.setup();
    }

    /**
     * Initializes the render system with configuration and event listeners
     * @private
     */
    private setup() : void {
        this.config();
        this.events();
        this.canvas.focus();

        this._backgroundImage.src = "/logo-dark-no-bg.png";
        this._backgroundImage.onload = () => {
            this._backgroundImageLoaded = true;
        };

        // The Transformer is created and owned here (exactly once per Render) so
        // that destroy() can tear it down. See Render.destroy().
        this.creator.Transformer();
    }

    /**
     * Configures canvas dimensions and boundary settings
     * @private
     */
    private config() : void {
        this.resize();
        this.boundary();
        this._defaultSprites();
    }

    /**
     * Creates default sprites for testing and demonstration purposes
     * @private
     */
    private _defaultSprites() : void {
        const config = localStorage.getItem("config");
        if (config) {
            const parsedConfig = JSON.parse(config);
            if (parsedConfig.setup) return;
        }

        localStorage.setItem("config", JSON.stringify({
            setup: true
        }));

        const default_sprites = [
            { 
                src: "/assets/Warrior/sprite.png", 
                pattern: ["18:25"], 
                spriteGrid: { rows: 17, cols: 6 }, 
                position: { x: 0.1 * this.canvas.width, y: 0.1 * this.canvas.height } 
            },
            { 
                src: "/assets/Warrior/sprite.png", 
                pattern: ["26:36"], 
                spriteGrid: { rows: 17, cols: 6 }, 
                position: { x: 0.3 * this.canvas.width, y: 0.7 * this.canvas.height } 
            },
            { 
                src: "/assets/Warrior/sprite.png", 
                pattern: ["18:25", "0(15)", "26:36", "36(15)"], 
                spriteGrid: { rows: 17, cols: 6 }, 
                position: { x: 0.2 * this.canvas.width, y: 0.4 * this.canvas.height } 
            },
        ]

        default_sprites.forEach(sprite => {
            this.creator.Sprite({
                src: sprite.src,
                spriteGrid: sprite.spriteGrid,
                pattern: sprite.pattern,
                scale: 3,
                position: this.creator.Vector(sprite.position.x, sprite.position.y),
            }).setDebug(true);
        })

        const spriteController = this.creator.Sprite({
            position: this.creator.Vector(0.8 * this.canvas.width, 0.5 * this.canvas.height),
            src: "/assets/Warrior/character.png",
            spriteGrid: { rows: 4, cols: 4 },
            scale: 3,
            dragging: true
        }).setDebug(true);

        spriteController.manager.controller({
            keywords: {
                up: "w",
                down: "s",
                left: "a",
                right: "d",
                jump: " "
            },
            status: {
                up: ["4:7"],
                down: ["0:3"],
                left: ["12:15"],
                right: ["8:11"],
                jump: ["4"],
                fall: ["8"],
                idle: ["0"]
            },
            speed: 5
        });
    }

    /**
     * Sets up global event listeners for window and mouse interactions
     * @private
     */
    private events() : void {
        window.addEventListener("resize", this._resizeBind);
        window.addEventListener("click", this._onClickedBind);
        window.addEventListener("touchstart", this._onTouchStartBind, { passive: false });
        window.addEventListener("touchmove", this._onTouchMoveBind, { passive: false });
        window.addEventListener("touchend", this._onTouchEndBind, { passive: false });
        window.addEventListener("mousemove", this._onMouseMoveBind);
        window.addEventListener("mousedown", this._onMouseDownBind);
        window.addEventListener("mouseup", this._onMouseUpBind);

        /**
         * Prevents default context menu (right-click) behavior
         */
        this.canvas.addEventListener("contextmenu", this._onContextMenuBind);

        // Wheel-zoom for the camera (Phase 3 §3.7).
        this.canvas.addEventListener("wheel", this._onWheelBind, { passive: false });
    }

    /**
     * Zooms the camera toward the cursor on wheel scroll (Phase 3 §3.7).
     * @param event - The wheel event.
     * @private
     */
    private _onWheel(event: WheelEvent) : void {
        event.preventDefault();
        const { left, top } = this.canvas.getBoundingClientRect();
        const screenX = event.clientX - left;
        const screenY = event.clientY - top;
        // Smooth, direction-aware zoom factor.
        const factor = Math.exp(-event.deltaY * 0.0015);
        this.camera.zoomAt(factor, screenX, screenY);
    }

    /**
     * Prevents the default browser context menu on the canvas
     * @param event - The contextmenu mouse event
     * @private
     */
    private _onContextMenu(event: MouseEvent) : void {
        event.preventDefault();
    }

    /**
     * Sets up boundary selection functionality for multi-select operations
     * @private
     */
    private boundary(): void {
        this.on("mousedown", (args) => {
            if (!(args.target instanceof Render) || !this._allowSelect) return;

            this._isSelecting = true;
            this._boundaryStart = args.pointer.relative;
            
            this._boundary = this.creator.Rect({
                position: this.creator.Vector(args.pointer.relative.x, args.pointer.relative.y),
                width: 0,
                height: 0,
                color: "rgba(0, 123, 255, 0.2)",
                zIndex: 1000
            });
            
            this._boundary.dragging = false;
        });

        this.on("mousemove", (args) => {
            if (!this._isSelecting || !this._boundaryStart || !this._boundary || !this._allowSelect) return;

            const startX = this._boundaryStart.x;
            const startY = this._boundaryStart.y;
            const currentX = args.pointer.relative.x;
            const currentY = args.pointer.relative.y;

            const x = Math.min(startX, currentX);
            const y = Math.min(startY, currentY);
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);

            this._boundary.position.x = x;
            this._boundary.position.y = y;
            this._boundary.width = width;
            this._boundary.height = height;
        });

        this.on("mouseup", () => {
            if (!this._isSelecting || !this._boundary || !this._transformer || !this._allowSelect) return;

            const selectedNodes = this._getNodesInBoundary();
            
            if (selectedNodes.length > 0) {
                this._selectedNodes = selectedNodes;
            }

            if (this._boundary) {
                this._boundary.destroy();
                this._boundary = null;
            }
            
            this._isSelecting = false;
            this._boundaryStart = null;
        });
    }

    /**
     * Resizes the canvas to match its container dimensions
     * @private
     */
    private resize(): void {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    /**
     * Returns the shapes in the render in order of their zIndex (highest first).
     * The result is cached and only recomputed when the child set or any zIndex
     * changes, avoiding the previous double-sort per frame (BUG-10, PERF-3).
     * @private
     */
    private _childs() : Shape[] {
        const values = [...this.childrens.values()];
        const signature = values.map((c) => `${c.id}:${c.zIndex}`).join("|");

        if (this._sortedChildsCache === null || signature !== this._lastZIndexSignature) {
            this._sortedChildsCache = values
                .map((item, index) => ({ item, index }))
                .sort((a, b) => (b.item.zIndex - a.item.zIndex) || (b.index - a.index))
                .map(({ item }) => item);
            this._lastZIndexSignature = signature;
        }

        return this._sortedChildsCache;
    }

    /**
     * Invalidates the cached z-order so it is rebuilt on next access.
     * @internal
     */
    public _invalidateChildsOrder() : void {
        this._sortedChildsCache = null;
    }

    /**
     * Returns the shapes in the render in reverse order
     * @private
     */
    private _childsInvert() : Shape[] {
        return [...this._childs()].reverse();
    }

    /**
     * Returns the shapes under the given instance in order of their zIndex
     * @private
     */
    private _getNodesUnder(instance: Shape) : Shape[] {
        const allChilds = [...this.childrens.values()]
            .map((item, index) => ({ item, index }))
            .sort((a, b) => b.index - a.index)
            .map(({item, index}) => ({item, index}));
        
        const instanceData = allChilds.find(child => child.item.id === instance.id);
        if (!instanceData) return [];
        
        return allChilds
            .filter(child => 
                child.item.zIndex < instance.zIndex || 
                (child.item.zIndex === instance.zIndex && child.index < instanceData.index)
            )
            .map(child => child.item);
    }

    /**
     * Returns the shapes above the given instance in order of their zIndex
     * @private
     */
    private _getNodesAbove(instance: Shape) : Shape[] {
        const allChilds = [...this.childrens.values()]
            .map((item, index) => ({ item, index }))
            .sort((a, b) => b.index - a.index)
            .map(({item, index}) => ({item, index}));
        
        const instanceData = allChilds.find(child => child.item.id === instance.id);
        if (!instanceData) return [];
        
        return allChilds
            .filter(child => 
                child.item.zIndex > instance.zIndex || 
                (child.item.zIndex === instance.zIndex && child.index > instanceData.index)
            )
            .map(child => child.item);
    }

    /**
     * Handles mouse move events from collaborators
     * Updates the position of collaborators based on their email
     * @param event - The mouse move event containing pointer information
     * @private
     */
    private _onSocketMouseMove(event: SocketEvents["user:mousemove"]) : void {
        this.collaborators.forEach(collaborator => {
            if (collaborator instanceof Pointer && collaborator.email === event.email) {
                collaborator.position.x = event.pointer.absolute.x;
                collaborator.position.y = event.pointer.absolute.y;
            }
        })
    }

    public _onSocketCollaborator(event: SocketEvents["user:collaborator"]) : void {
        void event;
    }

    /**
     * Handles mouse click events and determines click targets
     * Performs hit testing on shapes, updates target, and emits click events
     * @param event - The mouse event containing click information
     * @private
     */
    private _onClicked(event: MouseEvent) : void {
        const { clientX, clientY } = event;
        const { left, top, width, height } = this.canvas.getBoundingClientRect();
        const screenX = clientX - left;
        const screenY = clientY - top;

        const { target } = event;
        
        if (target !== this.canvas) return;
        if (screenX < 0 || screenX > width || screenY < 0 || screenY > height) return;

        // Pointer `relative` is reported in WORLD space (camera inverse) so all
        // hit-testing stays correct at any zoom/pan (Phase 3 §3.7).
        const world = this.camera.screenToWorld(screenX, screenY);
        this._mouseVector = world;

        this._target = this._childsInvert().find((child) => child._isClicked()) ?? this;

        this.emit("click", {
            pointer: {
                absolute: this.creator.Vector(clientX, clientY),
                relative: this.creator.Vector(world.x, world.y)
            },
            target: this._target
        });
        
        if (this._target instanceof Shape) {
            this._target.emit("click", {
                pointer: {
                    absolute: this.creator.Vector(clientX, clientY),
                    relative: this.creator.Vector(world.x, world.y)
                },
                target: this._target
            });
        }
    }

    /**
     * Handles touch start events and determines touch targets
     * Performs hit testing on shapes, updates target, and emits touch events
     * @param event - The touch event containing touch information
     * @private
     */
    private _onTouchStart(event: TouchEvent) : void {
        const touch = event.touches[0];
        if (!touch) return;
        this._isTouched = true;
        const { clientX, clientY } = touch;
        const { left, top, width, height } = this.canvas.getBoundingClientRect();
        const screenX = clientX - left;
        const screenY = clientY - top;

        const { target } = event;
        
        if (target !== this.canvas) return;
        if (screenX < 0 || screenX > width || screenY < 0 || screenY > height) return;

        const world = this.camera.screenToWorld(screenX, screenY);
        this._mouseVector = world;

        this._target = this._childsInvert().find((child) => child._isClicked()) ?? this;

        this.emit("touchstart", {
            pointer: {
                absolute: this.creator.Vector(clientX, clientY),
                relative: this.creator.Vector(world.x, world.y)
            },
            target: this._target
        });
        
        if (this._target instanceof Shape) {
            this._target.emit("click", {
                pointer: {
                    absolute: this.creator.Vector(clientX, clientY),
                    relative: this.creator.Vector(world.x, world.y)
                },
                target: this._target
            });
        }
    }

    /**
     * Handles touch movement events and updates touch position tracking
     * Updates target detection, and emits touchmove events
     * @param event - The touch event containing position information
     * @private
     */
    private _onTouchMove(event: TouchEvent) : void {
        const touch = event.touches[0];
        if (!touch) return;
        const { clientX, clientY } = touch;
        const { left, top } = this.canvas.getBoundingClientRect();
        const world = this.camera.screenToWorld(clientX - left, clientY - top);
        this._mouseVector = world;
        this.emit("touchmove", { pointer: { absolute: this.creator.Vector(clientX, clientY), relative: this.creator.Vector(world.x, world.y) }, target: this._target });
    }

    /**
     * Handles touch end events and finalizes touch drag operations
     * Completes touch interactions, and emits touchend events
     * @param event - The touch event containing touch information
     * @private
     */
    private _onTouchEnd(event: TouchEvent) : void {
        const changedTouch = event.changedTouches[0];
        if (changedTouch) {
            const { clientX, clientY } = changedTouch;
            const { left, top } = this.canvas.getBoundingClientRect();
            const world = this.camera.screenToWorld(clientX - left, clientY - top);

            this.emit("touchend", { pointer: { absolute: this.creator.Vector(clientX, clientY), relative: this.creator.Vector(world.x, world.y) }, target: this._target });
        
            if (this._isTouched) {
                this.emit("touch", { pointer: { absolute: this.creator.Vector(clientX, clientY), relative: this.creator.Vector(world.x, world.y) }, target: this._target });
                this._isTouched = false;
            }
        }
    }

    /**
     * Handles mouse movement events and updates mouse position tracking
     * Updates target detection, and emits mousemove events
     * @param event - The mouse event containing position information
     * @private
     */
    private _onMouseMove(event: MouseEvent) : void {
        const { clientX, clientY } = event;
        const { left, top } = this.canvas.getBoundingClientRect();
        const screenX = clientX - left;
        const screenY = clientY - top;

        // Middle-drag pans the CAMERA (Phase 3 §3.7): sprite positions are no
        // longer mutated by panning. Pan deltas are in screen pixels.
        if (this._isPanning && this._panAnchor) {
            this.camera.panBy(screenX - this._panAnchor.x, screenY - this._panAnchor.y);
            this._panAnchor = this.creator.Vector(screenX, screenY);
        }

        const world = this.camera.screenToWorld(screenX, screenY);
        this._mouseVector = world;

        this.emit("mousemove", { pointer: { absolute: this.creator.Vector(clientX, clientY), relative: this.creator.Vector(world.x, world.y) }, target: this._target });
    }
    
    /**
     * Handles mouse down events for drag operations and shape interaction
     * Initiates dragging behavior, and emits mousedown events
     * @param event - The mouse event containing position information
     * @private
     */
    private _onMouseDown(event: MouseEvent) : void {
        const { clientX, clientY } = event;
        const { left, top, width, height } = this.canvas.getBoundingClientRect();
        const screenX = clientX - left;
        const screenY = clientY - top;

        if (screenX < 0 || screenX > width || screenY < 0 || screenY > height) return;

        // Middle-button starts a camera pan regardless of what is under the
        // cursor (Phase 3 §3.7).
        if (event.button === 1) {
            this._isPanning = true;
            this._panAnchor = this.creator.Vector(screenX, screenY);
            return;
        }

        const world = this.camera.screenToWorld(screenX, screenY);
        this._mouseVector = world;

        this._target = this._childsInvert().find((child) => child._isClicked()) ?? this;

        this.emit("mousedown", { 
            pointer: { 
                absolute: this.creator.Vector(clientX, clientY), 
                relative: this.creator.Vector(world.x, world.y) 
            }, 
            target: this._target 
        });
    }
    
    /**
     * Handles mouse up events and finalizes drag operations
     * Completes boundary selection, and emits mouseup events
     * @param event - The mouse event containing position information
     * @private
     */
    private _onMouseUp(event: MouseEvent) : void {
        const { clientX, clientY } = event;
        const { left, top } = this.canvas.getBoundingClientRect();

        if (event.button === 1) {
            this._isPanning = false;
            this._panAnchor = null;
            return;
        }

        const world = this.camera.screenToWorld(clientX - left, clientY - top);
        this.emit("mouseup", { pointer: { absolute: this.creator.Vector(clientX, clientY), relative: this.creator.Vector(world.x, world.y) }, target: this._target });
    }

    /**
     * Gets all shapes that intersect with the current selection boundary
     * Used for multi-select operations with boundary rectangle
     * @returns Array of shapes within the boundary area
     * @private
     */
    private _getNodesInBoundary(): Shape[] {
        if (!this._boundary) return [];

        return this._childs().filter(shape => {
            if (shape === this._boundary) return false;
            return shape._isShapeInBoundary(this._boundary!.position.x, this._boundary!.position.y, this._boundary!.width, this._boundary!.height);
        });
    }

    /**
     * Updates the frames per second calculation
     * Tracks frame count and timing for performance monitoring
     * @private
     */
    private _updateFps() : void {
        const now = performance.now();
        const deltaTime = (now - this._lastFrameTime) / 1000;
        this._frameCount++;

        if (deltaTime >= 1) {
            this._fps = this._frameCount / deltaTime;
            this._frameCount = 0;   
            this._lastFrameTime = now;
        }
    }

    /**
     * Renders the current FPS counter on the canvas
     * Displays performance information in the bottom-left corner
     * @private
     */
    private _showFps() : void {
        const measureText = this.ctx.measureText(`FPS: ${this._fps.toFixed(2)}`);
        const textWidth = measureText.width;
        const textHeight = measureText.fontBoundingBoxAscent + measureText.fontBoundingBoxDescent;
        
        this.ctx.fillStyle = "white";
        this.ctx.font = "16px Arial";
        this.ctx.fillText(`FPS: ${this._fps.toFixed(2)}`, this.canvas.width - textWidth - 10, textHeight + 10);
    }

    /**
     * Clears the entire canvas for the next frame
     * @private
     */
    private clear() : void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Main render loop that draws all shapes and UI elements
     * Handles shape sorting, and frame rate display
     * @private
     */
    private render(): void {
        // Reset to the identity transform for screen-space drawing (clear,
        // background backdrop, FPS). Shapes/transformer are drawn under the
        // camera transform below (Phase 3 §3.7).
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.clear();

        if (this._backgroundImageLoaded) {
            this.ctx.globalAlpha = 0.1;
            
            const imageAspectRatio = this._backgroundImage.width / this._backgroundImage.height;
            
            let scaledWidth, scaledHeight;
            const maxSize = Math.min(this.canvas.width, this.canvas.height) * 0.6;
            
            if (imageAspectRatio > 1) {
                scaledWidth = maxSize;
                scaledHeight = maxSize / imageAspectRatio;
            } else {
                scaledHeight = maxSize;
                scaledWidth = maxSize * imageAspectRatio;
            }
            
            this.ctx.drawImage(
                this._backgroundImage,
                this.canvas.width / 2 - scaledWidth / 2,
                this.canvas.height / 2 - scaledHeight / 2,
                scaledWidth,
                scaledHeight
            );
            this.ctx.globalAlpha = 1.0;
        }

        // Apply the camera transform for all world-space drawing.
        this.ctx.setTransform(
            this.camera.scale, 0, 0, this.camera.scale,
            this.camera.x, this.camera.y
        );

        // _childs() is cached highest-zIndex-first; draw back-to-front by
        // walking it in reverse so lower zIndex shapes render first. The single
        // cached sort replaces the previous double-sort per frame (PERF-3).
        const ordered = this._childs();
        for (let i = ordered.length - 1; i >= 0; i--) {
            ordered[i]!.update();
        }
        this._transformer?.update();

        // FPS counter is screen-space UI, not world-space.
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this._updateFps();
        this._showFps();
        this._frameId = requestAnimationFrame(this._tickBind);
    }

    /**
     * Advances every controller one frame, then renders. This is the single
     * engine tick: controllers no longer own their own rAF loop (PERF-1).
     * @private
     */
    private _tick(): void {
        this._controllers.forEach((controller) => controller.tick());
        this.render();
    }

    /**
     * Sets the current user for the render
     * @param email - The email of the current user
     * @returns This render instance for method chaining
     */
    public setCurrentUser(email: string) : Render {
        this.currentUser = { email };
        return this;
    }

    /**
     * Enables boundary selection functionality
     * @returns This render instance for method chaining
     */
    public _enableSelect() : Render {
        this._allowSelect = true;
        return this;
    }

    /**
     * Disables boundary selection functionality
     * @returns This render instance for method chaining
     */
    public _disableSelect() : Render {
        this._allowSelect = false;
        return this;
    }

    /**
     * Cancels current selection operation and cleans up selection boundary
     * @returns This render instance for method chaining
     */
    public _cancelSelect() : Render {
        if (this._isSelecting && this._boundary) {
            this._boundary.destroy();
            this._boundary = null;
        }
        
        this._isSelecting = false;
        this._boundaryStart = null;
        this._allowSelect = false;
        return this;
    }

    /**
     * Gets the absolute mouse position relative to the page
     * @returns Vector containing absolute mouse coordinates
     */
    public mousePositionAbsolute() : Vector {
        const { left, top } = this.canvas.getBoundingClientRect();
        // _mouseVector is in world space; convert back to screen then to page.
        const screen = this.camera.worldToScreen(this._mouseVector.x, this._mouseVector.y);
        return this.creator.Vector(screen.x + left, screen.y + top);
    }

    /**
     * Gets the mouse position relative to the canvas
     * @returns Vector containing canvas-relative mouse coordinates
     */
    public mousePositionRelative() : Vector {
        return this._mouseVector;
    }

    /**
     * Adds a collaborator to the render context
     * @param collaborator - The collaborator to add
     */
    public addCollaborator(collaborator: Collaborator) : void {
        const shape = new Pointer({
            position: new Vector(300, 300),
            name: collaborator.name,
            color: collaborator.color,
        }, this, collaborator.id);

        this.collaborators.set(collaborator.id, shape);
    }

    /**
     * Removes a collaborator from the render context
     * @param collaboratorId - The ID of the collaborator to remove
     */
    public removeCollaborator(collaboratorId: string) : void {
        const shape = this.collaborators.get(collaboratorId);
        if (!shape) return;
        
        shape.destroy();
        this.collaborators.delete(collaboratorId);
    }

    /**
     * Serializes the render instance and its children into raw data
     * @returns Array of shape raw data objects
     */
    public serialize() : ShapeRawData[] {
        return [...this.childrens.values()].filter((child) => child instanceof Shape && child._autoSave).map((child) => child._rawData());
    }

    /**
     * Deserializes raw data into shape instances and adds them to the render
     * @param data - Array of shape raw data objects
     */
    public deserialize(data: ShapeRawData[]) : void {
        try {
            data.forEach((child) => {
                if (child.type === "circle") {
                    Circle._fromRawData(child as CircleRawData, this);
                } else if (child.type === "rect") {
                    Rect._fromRawData(child as RectRawData, this);
                } else if (child.type === "sprite") {
                    Sprite._fromRawData(child as SpriteRawData, this);
                } else if (child.type === "arrow") {
                    Arrow._fromRawData(child as ArrowRawData, this);
                }
            });
        } catch (error) {
            console.error("Error deserializing shape data:", error);
        }
    }

    /**
     * Requests an auto save of the scene using a trailing throttle with a
     * ~500 ms max-wait window: while requests keep arriving (e.g. a held movement
     * key), a write is guaranteed at least every <=500 ms. There is no leading
     * write on the first request of a burst. Use {@link flushSave} to force an
     * immediate synchronous write.
     */
    public autoSave() : void {
        this._savePending = true;
        if (this._saveTimeout !== null) return;

        this._saveTimeout = setTimeout(() => {
            this._saveTimeout = null;
            if (this._savePending) this.flushSave();
        }, this._saveMaxWait);
    }

    /**
     * Forces an immediate synchronous write of the scene to localStorage,
     * cancelling any pending throttled write. Wraps the write so a quota error
     * surfaces a non-blocking message and leaves the in-memory scene intact.
     */
    public flushSave() : void {
        if (this._saveTimeout !== null) {
            clearTimeout(this._saveTimeout);
            this._saveTimeout = null;
        }
        this._savePending = false;
        this._write();
    }

    /**
     * Performs the actual localStorage write, guarded against quota errors.
     * The scene is written through the ACTIVE named project (Phase 3 §3.2); the
     * `serialize()` → `ShapeRawData[]` contract is unchanged, only the storage
     * key/wrapper differs.
     * @private
     */
    private _write() : void {
        try {
            ProjectStore.saveActive(this.serialize());
        } catch (error) {
            const isQuota =
                error instanceof DOMException &&
                (error.name === "QuotaExceededError" || error.code === 22);

            if (isQuota) {
                console.warn("Render.autoSave: localStorage quota exceeded; scene not saved.");
                notify("Storage is full. Your changes could not be saved locally.", "error");
            } else {
                console.warn("Render.autoSave: failed to save scene.", error);
            }
        }
    }

    /**
     * Clears the ACTIVE project's scene (Phase 3 §3.2, resolves BUG-9).
     *
     * This no longer calls `localStorage.clear()`: it empties only the active
     * project via a scoped write, so other named projects, the legacy migration
     * backup, and `config.setup` all survive — which is why the first-run demo
     * sprites no longer reappear after a clear. The in-memory half tears down
     * every live child (destroying its controller, arrows, and transformer
     * attachment) before emptying the map, rather than orphaning live listeners.
     */
    public clearSave() : void {
        // Destroy live children so controllers/arrows/transformer links are torn
        // down (not orphaned). destroy() mutates `childrens`, so iterate a copy.
        for (const child of [...this.childrens.values()]) {
            child.destroy();
        }
        this.childrens.clear();
        this._invalidateChildsOrder();

        // Persist the now-empty active project (scoped; no global clear).
        this.flushSave();
    }

    /**
     * Loads the render instance and its children from raw data
     * Should be called after event listeners are registered
     */
    public load(data: ShapeRawData[]) : void {
        this.deserialize(data);
    }

    /**
     * Loads the active named project's scene, running the one-time
     * legacy→projects migration first if required (Phase 3 §3.2).
     */
    public loadActiveProject() : void {
        const data = ProjectStore.migrateIfNeeded();
        this.deserialize(data);
    }

    /**
     * Replaces the live scene with the given raw data: tears down current
     * children, deserializes the new data, and flushes the active project.
     * Used by scene import and project switching.
     * @param data - The scene to load.
     */
    public replaceScene(data: ShapeRawData[]) : void {
        for (const child of [...this.childrens.values()]) {
            child.destroy();
        }
        this.childrens.clear();
        this._invalidateChildsOrder();
        this.deserialize(data);
        this.flushSave();
    }

    /**
     * Starts the animation loop and begins rendering
     * @returns This render instance for method chaining
     */
    public start() : Render {
        if (this._frameId) return this;
        this._frameId = requestAnimationFrame(this._tickBind);
        return this;
    }

    /**
     * Stops the animation loop and pauses rendering
     * @returns This render instance for method chaining
     */
    public stop() : Render {
        if (this._frameId) {
            cancelAnimationFrame(this._frameId);
            this._frameId = null;
        }
        return this;
    }

    /**
     * Rebuilds a shape from its raw data (used by undo/redo to recreate a
     * deleted/created shape). Delegates to the per-type `_fromRawData`.
     * @param data - The raw data to rebuild from.
     * @internal
     */
    public _rebuildFromRaw(data: ShapeRawData) : void {
        if (data.type === "circle") Circle._fromRawData(data as CircleRawData, this);
        else if (data.type === "rect") Rect._fromRawData(data as RectRawData, this);
        else if (data.type === "sprite") Sprite._fromRawData(data as SpriteRawData, this);
        else if (data.type === "arrow") Arrow._fromRawData(data as ArrowRawData, this);
    }

    /**
     * Records the creation of a shape as an undoable command (Phase 3 §3.6).
     * The shape is assumed already created/added; undo destroys it, redo
     * rebuilds it from its captured raw data. No-op while (un)doing.
     * @param shape - The freshly created shape.
     */
    public recordCreate(shape: Shape) : void {
        if (this.history.isApplying) return;
        const snapshot = shape._rawData();
        this.history.push({
            label: "create",
            redo: () => {
                if (!this.childrens.has(snapshot.id)) this._rebuildFromRaw(snapshot);
            },
            undo: () => {
                const live = this.childrens.get(snapshot.id);
                if (live) live.destroy();
            },
        });
    }

    /**
     * Records the deletion of a shape as an undoable command (Phase 3 §3.6).
     * Capture the snapshot BEFORE calling this; the shape is assumed destroyed.
     * @param snapshot - The raw data captured before destruction.
     */
    public recordDelete(snapshot: ShapeRawData) : void {
        if (this.history.isApplying) return;
        this.history.push({
            label: "delete",
            redo: () => {
                const live = this.childrens.get(snapshot.id);
                if (live) live.destroy();
            },
            undo: () => {
                if (!this.childrens.has(snapshot.id)) this._rebuildFromRaw(snapshot);
            },
        });
    }

    /**
     * Records a position move as an undoable command (Phase 3 §3.6).
     * @param id - The shape id.
     * @param from - The position before the move.
     * @param to - The position after the move.
     */
    public recordMove(id: string, from: Vector, to: Vector) : void {
        if (this.history.isApplying) return;
        if (from.x === to.x && from.y === to.y) return;
        const fromX = from.x, fromY = from.y, toX = to.x, toY = to.y;
        this.history.push({
            label: "move",
            redo: () => {
                const live = this.childrens.get(id);
                if (live) { live.position.x = toX; live.position.y = toY; }
            },
            undo: () => {
                const live = this.childrens.get(id);
                if (live) { live.position.x = fromX; live.position.y = fromY; }
            },
        });
    }

    /**
     * Undoes the most recent recorded command (Phase 3 §3.6).
     * @returns This render instance for method chaining.
     */
    public undo() : Render {
        this.history.undo();
        this.autoSave();
        return this;
    }

    /**
     * Redoes the most recently undone command (Phase 3 §3.6).
     * @returns This render instance for method chaining.
     */
    public redo() : Render {
        this.history.redo();
        this.autoSave();
        return this;
    }

    /**
     * Destroys the render instance and cleans up all resources
     * Removes event listeners and stops the animation loop
     */
    public destroy() : void {
        this.stop();
        this.flushSave();

        window.removeEventListener("resize", this._resizeBind);
        window.removeEventListener("click", this._onClickedBind);
        window.removeEventListener("touchstart", this._onTouchStartBind);
        window.removeEventListener("touchmove", this._onTouchMoveBind);
        window.removeEventListener("touchend", this._onTouchEndBind);
        window.removeEventListener("mousemove", this._onMouseMoveBind);
        window.removeEventListener("mousedown", this._onMouseDownBind);
        window.removeEventListener("mouseup", this._onMouseUpBind);
        this.canvas.removeEventListener("contextmenu", this._onContextMenuBind);
        this.canvas.removeEventListener("wheel", this._onWheelBind);

        this._controllers.forEach((controller) => controller.destroy());
        this._transformer?.destroy();
        this._transformer = null;
    }
}