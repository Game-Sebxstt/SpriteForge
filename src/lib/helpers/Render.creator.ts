import { Circle as _Circle } from "../instances/_shapes/Circle";
import { Vector as _Vector } from "../common/Vector";
import { Render } from "../Render";
import { Sprite as _Sprite } from "../instances/_shapes/Sprite";
import { Rect as _Rect } from "../instances/_shapes/Rect";
import { Transformer as _Transformer } from "../common/Transformer";
import { Arrow as _Arrow } from "../instances/_shapes/Arrow";
import { Pointer as _Pointer, PointerProps } from "../instances/_shapes/Pointer";
import type { RectProps, CircleProps, SpriteProps, ArrowProps } from "../types/Shape";

/**
 * Factory class for creating shapes and utility objects within a render context
 * Provides convenient methods to instantiate shapes with automatic event emission
 */
export class RenderCreator {
    private _render: Render;

    /**
     * Creates a new render creator for the given render context
     * @param render - The render instance to associate created objects with
     */
    public constructor(render: Render) {
        this._render = render;
    }
    
    /**
     * Creates a new rectangle shape and emits creation event
     * @param props - Configuration properties for the rectangle
     * @returns A new Rect instance
     */
    public Rect(props: RectProps): _Rect {
        const rect = new _Rect(props, this._render);
        this._render.emit("create", { shape: rect })
        return rect;
    }

    /**
     * Creates a new circle shape and emits creation event
     * @param props - Configuration properties for the circle
     * @returns A new Circle instance
     */
    public Circle(props: CircleProps): _Circle {
        const circle = new _Circle(props, this._render);
        this._render.emit("create", { shape: circle });
        return circle;
    }

    /**
     * Creates a new sprite shape and emits creation event
     * @param props - Configuration properties for the sprite
     * @returns A new Sprite instance
     */
    public Sprite(props: SpriteProps): _Sprite {
        const sprite = new _Sprite(props, this._render);
        this._render.emit("create", { shape: sprite });
        return sprite;
    }
    
    /**
     * Creates a new arrow shape and emits creation event
     * @param props - Configuration properties for the arrow
     * @returns A new Arrow instance
     */
    public Arrow(props: ArrowProps): _Arrow {
        const arrow = new _Arrow(props, this._render);
        this._render.emit("create", { shape: arrow });
        return arrow;
    }

    /**
     * Creates a new pointer shape and emits creation event
     * @param props - Configuration properties for the pointer
     * @returns A new Pointer instance
     */
    public Pointer(props: PointerProps): _Pointer {
        const pointer = new _Pointer(props, this._render);
        this._render.emit("create", { shape: pointer });
        return pointer;
    }

    /**
     * Creates a new 2D vector with the specified coordinates
     * @param x - The x component of the vector
     * @param y - The y component of the vector
     * @returns A new Vector instance
     */
    public Vector(x: number, y: number): _Vector {
        return new _Vector(x, y);
    }

    /**
     * Creates a new transformer for interactive shape manipulation
     * @returns A new Transformer instance configured for this render context
     */
    public Transformer(): _Transformer {
        return new _Transformer(this._render.ctx, this._render)
    }
}