import { Render } from "@/lib/Render";
import { Shape } from "../Shape";
import { Vector } from "@/lib/common/Vector";
import type { ShapeProps } from "../../types/Shape";
import type { ShapeRawData } from "../../types/raw";

export interface PointerProps extends ShapeProps {
    scale?: number;
    name?: string;
    email?: string;
    color?: string;
}

export interface PointerRawData extends ShapeRawData {
    scale: number;
    name: string | undefined;
    email: string | undefined;
    color: string;
}

export class Pointer extends Shape {
    private _ctx: CanvasRenderingContext2D;

    private _image: HTMLImageElement = new Image();
    private _imageLoaded: boolean = false;

    private _scale: number;
    private _name: string | undefined;
    private _email: string | undefined;
    private _color: string;

    constructor(props: PointerProps, render: Render, id?: string) {
        super(props, render, id);
        this._ctx = render.ctx;
        this._scale = props.scale ?? 1;
        this._name = props.name;
        this._email = props.email;
        this._color = props.color ?? "white";

        this.setup();
    }

    private _svg(): Promise<HTMLImageElement> {
        return new Promise(async (resolve) => {
            const response = await fetch("/assets/cursor.svg");
            let svgTxt = await response.text();

            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgTxt, "image/svg+xml");

            const path = svgDoc.querySelector('path');
            if (path) {
                path.setAttribute('fill', this._color);
                path.setAttribute('stroke', this._color);
            }

            const serializer = new XMLSerializer();
            svgTxt = serializer.serializeToString(svgDoc);

            const img = new Image();
            const svgBlob = new Blob([svgTxt], { type: "image/svg+xml" });
            
            img.onload = () => resolve(img);

            img.src = URL.createObjectURL(svgBlob);
        });
    }

    public async setup(): Promise<void> {
        this._autoSave = false;

        this._image = await this._svg();
        this._imageLoaded = true;
    }

    public _isClicked(): boolean {
        return false;
    }

    public _isShapeInBoundary(boundaryX: number, boundaryY: number, boundaryWidth: number, boundaryHeight: number): boolean {
        return false;
    }

    public get email(): string | undefined {
        return this._email;
    }

    public get width(): number {
        return this._image.width * this._scale;
    }

    public get height(): number {
        return this._image.height * this._scale;
    }

    public override draw(): void {
        if (!this._imageLoaded) return;
        
        this._ctx.drawImage(this._image, this.position.x, this.position.y, this._image.width * this._scale, this._image.height * this._scale);

        if (this._name) {
            const measureText = this._ctx.measureText(this._name);
            const textWidth = measureText.width;
            const textHeight = measureText.fontBoundingBoxAscent + measureText.fontBoundingBoxDescent;

            this._ctx.fillText(
                this._name,
                this.position.x + this.width / 2 - textWidth / 2,
                this.position.y + this.height + textHeight
            );
        }
    }

    public override update(): void {
        super.update();
        this.draw();
    }

    public clone(): Pointer {
        return this._render.creator.Pointer({
            ...this,
            position: this.position.clone()
        })
    }

    public override _rawData(): PointerRawData {
        return {
            id: this.id,
            type: "pointer",
            name: this._name,
            position: this.position,
            rotation: this.rotation,
            zIndex: this.zIndex,
            dragging: this.dragging,
            visible: this.visible,
            scale: this._scale,
            color: this._color,
            email: this._email,
        };
    }

    public static override _fromRawData(_data: PointerRawData, _render: Render): Pointer {
        const props: PointerProps = {
            position: new Vector(_data.position.x, _data.position.y),
            rotation: _data.rotation,
            zIndex: _data.zIndex,
            dragging: _data.dragging,
            visible: _data.visible,
            scale: _data.scale,
            name: _data.name,
            color: _data.color,
            email: _data.email,
        };

        const shape = new Pointer(props, _render, _data.id);
        shape.setup();
        
        return shape;
    }

    public override destroy(): void {
        super.destroy();
    }
}