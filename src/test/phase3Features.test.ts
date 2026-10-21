import { describe, it, expect, beforeEach } from "vitest";
import { Render } from "@/lib/Render";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import { Vector } from "@/lib/common/Vector";
import { ProjectStore } from "@/lib/store/ProjectStore";
import type { SpriteRawData } from "@/lib/types/raw";

function makeRender(): Render {
  localStorage.setItem("config", JSON.stringify({ setup: true }));
  const canvas = document.createElement("canvas");
  return new Render(canvas);
}

function makeSprite(render: Render, overrides: Record<string, unknown> = {}): Sprite {
  return new Sprite(
    {
      position: new Vector(100, 100),
      src: "/assets/Warrior/sprite.png",
      spriteGrid: { rows: 4, cols: 4 },
      pattern: ["0:3"],
      scale: 2,
      ...overrides,
    },
    render
  );
}

describe("Phase 3 — variable FPS (§3.3)", () => {
  let render: Render;
  beforeEach(() => {
    render = makeRender();
  });

  it("persists fps only when set and round-trips", () => {
    const sprite = makeSprite(render, { fps: 24 });
    render.emit("create", { shape: sprite });
    const raw = sprite._rawData();
    expect(raw.fps).toBe(24);

    const render2 = makeRender();
    render2.deserialize(JSON.parse(JSON.stringify([raw])) as SpriteRawData[]);
    const rebuilt = [...render2.childrens.values()].find((c) => c instanceof Sprite) as Sprite;
    expect(rebuilt.fps).toBe(24);
  });

  it("omits fps from raw data when unset (legacy cadence, old blobs deserialize)", () => {
    const sprite = makeSprite(render);
    const raw = sprite._rawData();
    expect("fps" in raw).toBe(false);

    // A legacy blob with no fps field still deserializes.
    const render2 = makeRender();
    render2.deserialize(JSON.parse(JSON.stringify([raw])) as SpriteRawData[]);
    const rebuilt = [...render2.childrens.values()].find((c) => c instanceof Sprite) as Sprite;
    expect(rebuilt.fps).toBeUndefined();
  });
});

describe("Phase 3 — timeline / onion-skin (§3.4)", () => {
  let render: Render;
  beforeEach(() => {
    render = makeRender();
  });

  it("reports the resolved frame count and scrubs within range", () => {
    const sprite = makeSprite(render, { pattern: ["0:3"] });
    expect(sprite.getFrameCount()).toBe(4);

    sprite.setFrameIndex(2);
    expect(sprite.getFrameIndex()).toBe(2);

    // Clamped to the valid range.
    sprite.setFrameIndex(99);
    expect(sprite.getFrameIndex()).toBe(3);
    sprite.setFrameIndex(-5);
    expect(sprite.getFrameIndex()).toBe(0);
  });

  it("toggles onion-skinning (view-only, not persisted)", () => {
    const sprite = makeSprite(render);
    expect(sprite.isOnionSkin()).toBe(false);
    sprite.setOnionSkin(true);
    expect(sprite.isOnionSkin()).toBe(true);
    // Onion-skin is not part of the persistence contract.
    expect("onionSkin" in sprite._rawData()).toBe(false);
  });

  it("resolves frames for export", () => {
    const sprite = makeSprite(render, { pattern: ["0:3"] });
    expect(sprite.getResolvedFrames()).toEqual([0, 1, 2, 3]);
  });
});

describe("Phase 3 — clearSave scoped semantics (§3.2, BUG-9)", () => {
  it("empties the active project and preserves config.setup (no demo reseed)", () => {
    const render = makeRender();
    const sprite = makeSprite(render);
    render.emit("create", { shape: sprite });
    expect(render.childrens.size).toBeGreaterThan(0);

    render.clearSave();

    // In-memory scene emptied.
    expect(render.childrens.size).toBe(0);
    // config.setup untouched, so defaults never reseed.
    expect(localStorage.getItem("config")).toBe(JSON.stringify({ setup: true }));
    // Active project is now empty (scoped write, not a global clear).
    expect(ProjectStore.getActiveData()).toEqual([]);
  });
});

describe("Phase 3 — undo/redo via the engine (§3.6)", () => {
  it("records and reverts a create", () => {
    const render = makeRender();
    const sprite = render.creator.Sprite({
      position: new Vector(0, 0),
      src: "/x.png",
      spriteGrid: { rows: 1, cols: 1 },
    });
    render.recordCreate(sprite);
    const id = sprite.id;
    expect(render.childrens.has(id)).toBe(true);

    render.undo();
    expect(render.childrens.has(id)).toBe(false);

    render.redo();
    expect(render.childrens.has(id)).toBe(true);
  });

  it("records and reverts a delete", () => {
    const render = makeRender();
    const sprite = render.creator.Sprite({
      position: new Vector(5, 5),
      src: "/x.png",
      spriteGrid: { rows: 1, cols: 1 },
    });
    const id = sprite.id;
    const snapshot = sprite._rawData();
    sprite.destroy();
    render.recordDelete(snapshot);
    expect(render.childrens.has(id)).toBe(false);

    render.undo();
    expect(render.childrens.has(id)).toBe(true);

    render.redo();
    expect(render.childrens.has(id)).toBe(false);
  });

  it("records and reverts a move", () => {
    const render = makeRender();
    const sprite = render.creator.Sprite({
      position: new Vector(0, 0),
      src: "/x.png",
      spriteGrid: { rows: 1, cols: 1 },
    });
    const id = sprite.id;
    const from = sprite.position.clone();
    sprite.position.x = 200;
    sprite.position.y = 150;
    render.recordMove(id, from, sprite.position.clone());

    render.undo();
    expect(render.childrens.get(id)!.position.x).toBe(0);
    expect(render.childrens.get(id)!.position.y).toBe(0);

    render.redo();
    expect(render.childrens.get(id)!.position.x).toBe(200);
    expect(render.childrens.get(id)!.position.y).toBe(150);
  });
});

describe("Phase 3 — zoom/pan camera hit-testing (§3.7)", () => {
  it("hit-tests a sprite in WORLD space at a non-identity camera", () => {
    const render = makeRender();
    const sprite = makeSprite(render, { position: new Vector(100, 100) });
    render.emit("create", { shape: sprite });

    // World-space point inside the sprite's frame box.
    render.camera.x = 300;
    render.camera.y = 50;
    render.camera.scale = 2;

    // mousePositionRelative is driven off the internal world vector; set it via
    // a synthetic world coordinate by reading back the camera inverse.
    const worldPoint = render.camera.screenToWorld(
      // screen point that maps to world (110,110): screen = world*scale + offset
      110 * 2 + 300,
      110 * 2 + 50
    );
    // Push the world point into the render by faking the mouse vector.
    (render as unknown as { _mouseVector: Vector })._mouseVector = worldPoint;

    expect(sprite._isClicked()).toBe(true);
  });
});
