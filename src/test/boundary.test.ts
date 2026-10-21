import { describe, it, expect, beforeEach } from "vitest";
import { Render } from "@/lib/Render";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import { Vector } from "@/lib/common/Vector";
import { isPointInRotatedRect } from "@/lib/lib/Utils";

function makeRender(): Render {
  localStorage.setItem("config", JSON.stringify({ setup: true }));
  const canvas = document.createElement("canvas");
  return new Render(canvas);
}

function makeSprite(render: Render, x: number, y: number, scale = 1): Sprite {
  const sprite = new Sprite(
    {
      position: new Vector(x, y),
      src: "/x.png",
      spriteGrid: { rows: 1, cols: 1 },
      scale,
    },
    render
  );
  // Force frame dimensions deterministically (setup resolves to 64x64 in tests).
  (sprite as unknown as { _widthFrame: number; _heightFrame: number; _loading: boolean })._widthFrame = 64;
  (sprite as unknown as { _widthFrame: number; _heightFrame: number; _loading: boolean })._heightFrame = 64;
  (sprite as unknown as { _loading: boolean })._loading = false;
  return sprite;
}

describe("Sprite._isShapeInBoundary", () => {
  let render: Render;

  beforeEach(() => {
    render = makeRender();
  });

  it("returns true when the sprite overlaps the boundary", () => {
    const sprite = makeSprite(render, 50, 50);
    expect(sprite._isShapeInBoundary(0, 0, 100, 100)).toBe(true);
  });

  it("returns false when the sprite is fully outside the boundary", () => {
    const sprite = makeSprite(render, 500, 500);
    expect(sprite._isShapeInBoundary(0, 0, 100, 100)).toBe(false);
  });

  it("returns true for an edge-touching sprite", () => {
    // Sprite spans [100,164] in x; boundary right edge is exactly 100.
    const sprite = makeSprite(render, 100, 0);
    expect(sprite._isShapeInBoundary(0, 0, 100, 100)).toBe(true);
  });
});

describe("isPointInRotatedRect (shared hit-test helper)", () => {
  it("hits an axis-aligned rect", () => {
    expect(isPointInRotatedRect(10, 10, 0, 0, 20, 20, 0)).toBe(true);
    expect(isPointInRotatedRect(30, 10, 0, 0, 20, 20, 0)).toBe(false);
  });

  it("respects rotation when transforming the point to local space", () => {
    // 90deg rotation about origin: a point along +Y maps into the local box.
    const rot = Math.PI / 2;
    expect(isPointInRotatedRect(-5, 10, 0, 0, 40, 20, rot)).toBe(true);
    expect(isPointInRotatedRect(5, 10, 0, 0, 40, 20, rot)).toBe(false);
  });
});
