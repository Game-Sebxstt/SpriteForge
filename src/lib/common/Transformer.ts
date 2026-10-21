import { Render } from "../Render";
import { Shape } from "../instances/Shape";
import { Circle } from "../instances/_shapes/Circle";
import { Rect } from "../instances/_shapes/Rect";
import { Sprite } from "../instances/_shapes/Sprite";
import { v4 as uuidv4 } from "uuid";
import { Vector } from "./Vector";
import type { TransformerBounds } from "../types/Transformer";
import type {
    RenderEventTouched,
    RenderEventMouseDown,
    RenderEventMouseMove,
    RenderEventMouseUp,
} from "../types/RenderProvider";

/**
 * Interactive transformation tool for shapes (move, resize, select)
 * Provides visual handles and drag functionality for shape manipulation
 */
export class Transformer {
    private _ctx: CanvasRenderingContext2D;
    private _render: Render;
    private _id: string;

    private _isDragging: boolean = false;
    private _dragStart: Vector | null = null;
    private _shifted: boolean = false;
    private _justFinishedDrag: boolean = false;
    /** Per-node positions captured at drag start, for undoable moves (§3.6). */
    private _dragOrigin: Map<string, Vector> = new Map();

    private _isResizing: boolean = false;
    private _resizeStart: Vector | null = null;
    private _resizeHandle: TransformerBounds | null = null;
    private _initialDimensions: { width: number, height: number, x: number, y: number } | null = null;
    private _initialNodeStates: Array<{
        position: Vector,
        width?: number,
        height?: number,
        radius?: number,
        scale?: number
    }> = [];

    private _nodes: Shape[] = [];
    private _boundarys: Record<TransformerBounds, Vector> = {
        "top-left": new Vector(0, 0),
        "top-right": new Vector(1, 0),
        "bottom-left": new Vector(0, 1),
        "bottom-right": new Vector(1, 1)
    };

    public padding: number = 10;

    private _onClickedBind: (args: RenderEventTouched) => void = this._onClickedTr.bind(this);
    private _onTouchedBind: (args: RenderEventTouched) => void = this._onTouchedTr.bind(this);
    private _onMouseDownBind: (args: RenderEventMouseDown) => void = this._onMouseDownTr.bind(this);
    private _onMouseMoveBind: (args: RenderEventMouseMove) => void = this._onMouseMoveTr.bind(this);
    private _onMouseUpBind: (args: RenderEventMouseUp) => void = this._onMouseUpTr.bind(this);
    private _onTouchStartBind: (args: RenderEventMouseDown) => void = this._onTouchStartTr.bind(this);
    private _onTouchEndBind: (args: RenderEventMouseUp) => void = this._onTouchEndTr.bind(this);
    private _onKeyDownBind: (e: KeyboardEvent) => void = this._onKeyDown.bind(this);
    private _onKeyUpBind: (e: KeyboardEvent) => void = this._onKeyUp.bind(this);

    /**
     * Creates a new transformer for interactive shape manipulation
     * @param ctx - Canvas rendering context for drawing transformation UI
     * @param render - Render instance for event handling and shape management
     */
    public constructor(ctx: CanvasRenderingContext2D, render: Render) {
        this._ctx = ctx;
        this._render = render;
        this._id = uuidv4();
        this._render.manager.addTransformer(this);

        this.events();
    }

    /**
     * Sets up event listeners for mouse, touch and keyboard interactions
     * @private
     */
    private events(): void {
        this._render.on("click", this._onClickedBind);
        this._render.on("touch", this._onTouchedBind);

        this._render.on("mousedown", this._onMouseDownBind);
        this._render.on("mousemove", this._onMouseMoveBind);
        this._render.on("mouseup", this._onMouseUpBind);

        this._render.on("touchstart", this._onTouchStartBind);
        this._render.on("touchmove", this._onMouseMoveBind);
        this._render.on("touchend", this._onTouchEndBind);

        window.addEventListener("keydown", this._onKeyDownBind);
        window.addEventListener("keyup", this._onKeyUpBind);
    }

    /**
     * Destroys the transformer, removing every DOM and engine-emitter listener
     * it registered (by the same stored reference) and detaching itself from the
     * render manager so it is not referenced after teardown.
     */
    public destroy(): void {
        this._render.off("click", this._onClickedBind);
        this._render.off("touch", this._onTouchedBind);

        this._render.off("mousedown", this._onMouseDownBind);
        this._render.off("mousemove", this._onMouseMoveBind);
        this._render.off("mouseup", this._onMouseUpBind);

        this._render.off("touchstart", this._onTouchStartBind);
        this._render.off("touchmove", this._onMouseMoveBind);
        this._render.off("touchend", this._onTouchEndBind);

        window.removeEventListener("keydown", this._onKeyDownBind);
        window.removeEventListener("keyup", this._onKeyUpBind);

        this._nodes = [];
        this._render.manager.removeTransformer();
    }

    /**
     * Handles click events for transformer selection and management
     * Manages shape selection, multi-select with Shift key, and selection clearing
     * @param args - Click event arguments containing target and pointer information
     * @private
     */
    private _onClickedTr(args: RenderEventTouched): void {
        if (this._justFinishedDrag) {
            this._justFinishedDrag = false;
            return;
        }

        if (args.target instanceof Render) {
            this.clear();
        }

        if (this._render._selectedNodes.length > 0) {
            this.clear();
            this.list([...this._render._selectedNodes]);
            this._render._selectedNodes = [];
        }

        if (args.target instanceof Shape) {
            if (!this._shifted) {
                this.clear();
            }

            this.add(args.target);
        }
    }

    private _onTouchedTr(args: RenderEventTouched): void {
        this._onClickedTr(args);
    }

    /**
     * Handles touch start events for transformer interactions
     * Initiates resize operations or drag operations based on touch target
     * @param args - Touch start event arguments containing target and pointer information
     * @private
     */
    private _onTouchStartTr(args: RenderEventMouseDown): void {
        this._onMouseDownTr(args);
    }

    /**
     * Handles touch end events to finalize transformer operations
     * Completes drag and resize operations, resets state flags
     * @private
     */
    private _onTouchEndTr(args: RenderEventMouseUp): void {
        this._onMouseUpTr(args);
    }

    /**
     * Handles mouse down events for transformer interactions
     * Initiates resize operations or drag operations based on click target
     * @param args - Mouse down event arguments containing target and pointer information
     * @private
     */
    private _onMouseDownTr(args: RenderEventMouseDown): void {
        const clickedHandle = this._getClickedHandle();
        if (clickedHandle) {
            this._isResizing = true;
            this._resizeStart = args.pointer.relative;
            this._resizeHandle = clickedHandle;
            this._initialDimensions = this._dimension();
            this._saveInitialNodeStates();
            this._render._cancelSelect();
            return;
        }

        if (args.target instanceof Shape) {
            const targetShape = args.target as Shape;
            const isNodeInTransformer = this._nodes.some(node => node.id === targetShape.id);
            
            if (!this._shifted && !isNodeInTransformer) {
                this.clear();
            }

            if (!isNodeInTransformer) {
                this.add(targetShape);
            }
            
            if (isNodeInTransformer || this._nodes.length > 0) {
                this._isDragging = true;
                this._dragStart = args.pointer.relative;
                this._captureDragOrigin();
            }
        }

        if (this._isClicked() && !this._isResizing) {
            this._isDragging = true;
            this._dragStart = args.pointer.relative;
            this._captureDragOrigin();
        
            this._nodes.forEach(node => node.emit("dragstart", {
                pointer: args.pointer,
                target: node
            }));
        }
    }

    /**
     * Handles mouse move events during transformer operations
     * Processes dragging and resizing operations based on current state
     * @param args - Mouse move event arguments containing pointer information
     * @private
     */
    private _onMouseMoveTr(args: RenderEventMouseMove): void {
        if (this._isDragging) {
            const mouseVector = args.pointer.relative;
            const delta = mouseVector.sub(this._dragStart!);
            this._dragStart = mouseVector;

            this._nodes.forEach(node => {
                node.position.x += delta.x;
                node.position.y += delta.y;
            });

            this._render._cancelSelect();
            this._nodes.forEach(node => node.emit("drag", {
                pointer: args.pointer,
                target: node
            }));
        }

        if (this._isResizing && this._resizeHandle && this._initialDimensions) {
            this._performResize(args.pointer.relative);
        }
    }

    /**
     * Handles mouse up events to finalize transformer operations
     * Completes drag and resize operations, resets state flags
     * @private
     */
    private _onMouseUpTr(args: RenderEventMouseUp): void {
        if (this._isDragging) {
            this._isDragging = false;
            this._dragStart = null;
            this._justFinishedDrag = true;
            this._render._enableSelect();
            // Record each node's net move as an undoable command (Phase 3 §3.6).
            this._nodes.forEach(node => {
                const origin = this._dragOrigin.get(node.id);
                if (origin) {
                    this._render.recordMove(node.id, origin, node.position.clone());
                }
                node.emit("dragend", {
                    pointer: args.pointer,
                    target: node
                });
            });
            this._dragOrigin.clear();
        }

        if (this._isResizing) {
            this._isResizing = false;
            this._resizeStart = null;
            this._resizeHandle = null;
            this._initialDimensions = null;
            this._initialNodeStates = [];
            this._render._enableSelect();
        }

        this._render.autoSave();
    }

    /**
     * Handles keyboard key down events for transformer shortcuts
     * Manages Shift key for multi-select and other keyboard interactions
     * @param e - Keyboard event containing key information
     * @private
     */
    private _onKeyDown(e: KeyboardEvent): void {
        if (e.key === "Shift") {
            this._shifted = true;
        }

        if (e.ctrlKey && e.key.toLowerCase() === "f") {
            e.preventDefault();
            this._nodes.forEach(node => {
                node.manager.bodyVelocity(this._render.creator.Vector(0, 0), 5);
            })
        }

        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f"){
            e.preventDefault();
            this._nodes.forEach(node => {
                if (node.bodyVelocity) node.bodyVelocity.destroy();
            })
        }


        if (e.ctrlKey && e.key.toLowerCase() === "x") {
            const nodesToDestroy = [...this._nodes];
            // Capture snapshots before destruction so each delete is undoable (§3.6).
            const snapshots = nodesToDestroy.map(node => node._rawData());
            nodesToDestroy.forEach(node => node.destroy());
            snapshots.forEach(snapshot => this._render.recordDelete(snapshot));
            this.clear();
        }

        if (e.ctrlKey && e.key.toLowerCase() === "d") {
            e.preventDefault();
            const nodesCloned = this._nodes.map(node => node.clone());
            nodesCloned.forEach(node => {
                if (node instanceof Circle) {
                    node.position.x += node.radius * 2.4;
                }

                if (node instanceof Rect) {
                    node.position.x += node.width * 1.2;
                }

                if (node instanceof Sprite) {
                    node.position.x += node.getWidth() * 2;
                }
            });
            // Record after the offset so redo recreates at the final position (§3.6).
            nodesCloned.forEach(node => this._render.recordCreate(node));
        }

        if (e.ctrlKey && e.key.toLowerCase() === "s") {
            e.preventDefault();
            // Persist through the active named project (Phase 3 §3.2), not the
            // legacy single-slot key.
            this._render.flushSave();
        }
            
    }

    /**
     * Handles keyboard key up events for transformer shortcuts
     * Resets modifier key states like Shift for multi-select
     * @param e - Keyboard event containing key information
     * @private
     */
    private _onKeyUp(e: KeyboardEvent): void {
        if (e.key === "Shift") {
            this._shifted = false;
        }
    }

    /**
     * Captures each selected node's current position so a completed drag can be
     * recorded as an undoable move command (Phase 3 §3.6).
     * @private
     */
    private _captureDragOrigin(): void {
        this._dragOrigin.clear();
        this._nodes.forEach(node => {
            this._dragOrigin.set(node.id, node.position.clone());
        });
    }

    /**
     * Calculates the bounding box dimensions of all selected shapes
     * Returns the combined width, height, and position of the selection
     * @returns Object containing width, height, x, and y of the bounding box
     * @private
     */
    private _dimension(): { width: number, height: number, x: number, y: number } {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        this._nodes.forEach(node => {
            if (node instanceof Rect) {
                minX = Math.min(minX, node.position.x);
                minY = Math.min(minY, node.position.y);
                maxX = Math.max(maxX, node.position.x + node.width);
                maxY = Math.max(maxY, node.position.y + node.height);
            }

            if (node instanceof Circle) {
                minX = Math.min(minX, node.position.x - node.radius);
                minY = Math.min(minY, node.position.y - node.radius);
                maxX = Math.max(maxX, node.position.x + node.radius);
                maxY = Math.max(maxY, node.position.y + node.radius);
            }

            if (node instanceof Sprite) {
                minX = Math.min(minX, node.position.x);
                minY = Math.min(minY, node.position.y);
                maxX = Math.max(maxX, node.position.x + node.getWidth());
                maxY = Math.max(maxY, node.position.y + node.getHeight());
            }
        })

        const width = maxX - minX;
        const height = maxY - minY;

        return { width, height, x: minX, y: minY };
    }

    /**
     * Draws the selection rectangle around the selected shapes
     * Renders the main bounding box with border styling
     * @private
     */
    private _rect(): void {
        const { width, height, x, y } = this._dimension();
        this._ctx.beginPath();
        this._ctx.rect(x - this.padding, y - this.padding, width + this.padding * 2, height + this.padding * 2);
        this._ctx.strokeStyle = "red";
        this._ctx.lineWidth = 2;
        this._ctx.stroke();
    }

    /**
     * Draws the resize handles at the corners of the selection rectangle
     * Renders interactive corner handles for resizing operations with larger touch targets
     * @private
     */
    private _bounds(): void {
        const { width, height, x, y } = this._dimension();
        const radius = 15;
        
        const transformerX = x - this.padding;
        const transformerY = y - this.padding;
        const transformerWidth = width + this.padding * 2;
        const transformerHeight = height + this.padding * 2;
        
        Object.entries(this._boundarys).forEach(([key]) => {
            const boundary = this._boundarys[key as keyof typeof this._boundarys];
            
            const rx = transformerX + boundary.x * transformerWidth - radius / 2;
            const ry = transformerY + boundary.y * transformerHeight - radius / 2;
            
            this._ctx.beginPath();
            this._ctx.rect(rx - 2.5, ry - 2.5, radius + 5, radius + 5);
            this._ctx.fillStyle = "transparent";
            this._ctx.fill();
            this._ctx.closePath();
            
            this._ctx.beginPath();
            this._ctx.rect(rx, ry, radius, radius);
            this._ctx.fillStyle = "red";
            this._ctx.fill();
            this._ctx.strokeStyle = "white";
            this._ctx.lineWidth = 2;
            this._ctx.stroke();
            this._ctx.closePath();
        })
    }

    /**
     * Determines which resize handle (if any) was clicked by the mouse or touch
     * Tests pointer position against all corner handle positions with larger touch targets
     * @returns The clicked handle identifier or null if none clicked
     * @private
     */
    private _getClickedHandle(): TransformerBounds | null {
        const pointerVector = this._render.mousePositionRelative();
        const { x, y, width, height } = this._dimension();
        
        const transformerX = x - this.padding;
        const transformerY = y - this.padding;
        const transformerWidth = width + this.padding * 2;
        const transformerHeight = height + this.padding * 2;
        
        const radius = 15;
        const touchRadius = radius + 5;
        
        for (const [key, boundary] of Object.entries(this._boundarys)) {
            const rx = transformerX + boundary.x * transformerWidth - radius / 2;
            const ry = transformerY + boundary.y * transformerHeight - radius / 2;
            
            const hitRadius = touchRadius;
            const hitX = rx - (hitRadius - radius) / 2;
            const hitY = ry - (hitRadius - radius) / 2;
            
            if (pointerVector.x >= hitX && 
                pointerVector.x <= hitX + hitRadius && 
                pointerVector.y >= hitY && 
                pointerVector.y <= hitY + hitRadius) {
                return key as TransformerBounds;
            }
        }
        
        return null;
    }

    /**
     * Saves the initial state of all selected nodes before resize operation
     * Stores position, dimensions, and scale for proportional resizing
     * @private
     */
    private _saveInitialNodeStates(): void {
        this._initialNodeStates = this._nodes.map(node => {
            const state: { position: Vector, width?: number, height?: number, radius?: number, scale?: number } = {
                position: new Vector(node.position.x, node.position.y)
            };

            if (node instanceof Rect) {
                state.width = node.width;
                state.height = node.height;
            } else if (node instanceof Circle) {
                state.radius = node.radius;
            } else if (node instanceof Sprite) {
                state.scale = node.scale || 1;
            }

            return state;
        });
    }

    /**
     * Performs the resize operation based on current mouse position
     * Calculates new dimensions and applies them to all selected shapes
     * @param currentMouse - Current mouse position for resize calculation
     * @private
     */
    private _performResize(currentMouse: Vector): void {
        if (!this._resizeStart || !this._resizeHandle || !this._initialDimensions || this._initialNodeStates.length === 0) return;

        const delta = currentMouse.sub(this._resizeStart);
        const { x: initialX, y: initialY, width: initialWidth, height: initialHeight } = this._initialDimensions;

        let newX = initialX;
        let newY = initialY;
        let newWidth = initialWidth;
        let newHeight = initialHeight;

        switch (this._resizeHandle) {
            case "top-left":
                newX = initialX + delta.x;
                newY = initialY + delta.y;
                newWidth = initialWidth - delta.x;
                newHeight = initialHeight - delta.y;
                break;
            case "top-right":
                newY = initialY + delta.y;
                newWidth = initialWidth + delta.x;
                newHeight = initialHeight - delta.y;
                break;
            case "bottom-left":
                newX = initialX + delta.x;
                newWidth = initialWidth - delta.x;
                newHeight = initialHeight + delta.y;
                break;
            case "bottom-right":
                newWidth = initialWidth + delta.x;
                newHeight = initialHeight + delta.y;
                break;
        }

        if (newWidth < 20 || newHeight < 20) return;

        const scaleX = newWidth / initialWidth;
        const scaleY = newHeight / initialHeight;

        this._nodes.forEach((node, index) => {
            const initialState = this._initialNodeStates[index];
            if (!initialState) return;

            const relativeX = (initialState.position.x - initialX) / initialWidth;
            const relativeY = (initialState.position.y - initialY) / initialHeight;

            node.position.x = newX + relativeX * newWidth;
            node.position.y = newY + relativeY * newHeight;

            if (node instanceof Rect && initialState.width !== undefined && initialState.height !== undefined) {
                const nodeRelativeWidth = initialState.width / initialWidth;
                const nodeRelativeHeight = initialState.height / initialHeight;
                node.width = nodeRelativeWidth * newWidth;
                node.height = nodeRelativeHeight * newHeight;
            } else if (node instanceof Circle && initialState.radius !== undefined) {
                const nodeRelativeRadius = initialState.radius / Math.min(initialWidth, initialHeight);
                node.radius = nodeRelativeRadius * Math.min(newWidth, newHeight);
            } else if (node instanceof Sprite && initialState.scale !== undefined) {
                node.scale = initialState.scale * Math.min(scaleX, scaleY);
            }
        });
    }

    /**
     * Determines if the transformer area is currently being clicked
     * Tests if pointer position is within the transformer bounds including padding
     * @returns True if transformer is clicked, false otherwise
     */
    public _isClicked(): boolean {
        const pointerVector = this._render.mousePositionRelative();
        const { x, y, width, height } = this._dimension();
        
        const transformerX = x - this.padding;
        const transformerY = y - this.padding;
        const transformerWidth = width + this.padding * 2;
        const transformerHeight = height + this.padding * 2;
        
        const isInTransformerArea = pointerVector.x >= transformerX && 
                                   pointerVector.x <= transformerX + transformerWidth && 
                                   pointerVector.y >= transformerY && 
                                   pointerVector.y <= transformerY + transformerHeight;
        
        return isInTransformerArea;
    }

    /**
     * Gets the unique identifier for this transformer
     * @returns The UUID string identifier
     */
    public get id(): string {
        return this._id;
    }

    /**
     * Gets the array of shapes currently selected by this transformer
     * @returns Array of Shape instances being transformed
     */
    public get nodes(): Shape[] {
        return this._nodes;
    }

    /**
     * Adds a shape to the transformer selection
     * @param node - The shape to add to selection
     * @returns This transformer instance for method chaining
     */
    public add(node: Shape) : Transformer {
        this._nodes.push(node);
        node.dragging = false;
        node._transformer = this;
        node.emit("select");
        return this;
    }

    /**
     * Sets multiple shapes as the transformer selection
     * @param nodes - Array of shapes to select
     * @returns This transformer instance for method chaining
     */
    public list(nodes: Shape[]) : Transformer {
        this._nodes = nodes;
        this._nodes.forEach(node => node.emit("select"));
        return this;
    }

    /**
     * Clears all shapes from the transformer selection
     * @returns This transformer instance for method chaining
     */
    public clear() : Transformer {
        this._nodes.forEach(node => node.emit("deselect"));
        this._nodes.forEach(node => node.dragging = true);
        this._nodes = [];
        return this;
    }

    /**
     * Removes a specific shape from the transformer selection
     * @param node - The shape to remove from selection
     * @returns This transformer instance for method chaining
     */
    public remove(node: Shape) : Transformer {
        this._nodes = this._nodes.filter(n => n.id !== node.id);
        node.dragging = true;
        node._transformer = null;
        node.emit("deselect");
        return this;
    }

    /**
     * Checks if a shape is currently selected by this transformer
     * @param node - The shape to check
     * @returns True if shape is selected, false otherwise
     */
    public hasNode(node: Shape) : boolean {
        return this._nodes.some(n => n.id === node.id);
    }

    /**
     * Updates and renders the transformer UI (selection box and handles)
     * Called each frame to draw transformation controls
     */
    public update() : void {
        this._rect();
        this._bounds();
    }
}