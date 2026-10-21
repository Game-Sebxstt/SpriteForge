import { describe, it, expect, beforeEach } from "vitest";
import { Render } from "@/lib/Render";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import { Vector } from "@/lib/common/Vector";
import { useSceneStore } from "@/lib/store/useSceneStore";
import { attachEngineBridge } from "@/lib/store/engineBridge";

function makeRender(): Render {
  localStorage.setItem("config", JSON.stringify({ setup: true }));
  const canvas = document.createElement("canvas");
  return new Render(canvas);
}

describe("engine -> store bridge", () => {
  let render: Render;
  let detach: () => void;

  beforeEach(() => {
    useSceneStore.getState().reset();
    render = makeRender();
    detach = attachEngineBridge(render);
  });

  it("adds a sprite view when a sprite is created", () => {
    const sprite = render.creator.Sprite({
      position: new Vector(0, 0),
      src: "/x.png",
      spriteGrid: { rows: 1, cols: 1 },
    });

    const state = useSceneStore.getState();
    expect(state.sprites).toHaveLength(1);
    expect(state.views[sprite.id]).toBeDefined();
    expect(state.views[sprite.id]!.isPlaying).toBe(true);
  });

  it("reflects play/pause transitions", () => {
    const sprite = render.creator.Sprite({
      position: new Vector(0, 0),
      src: "/x.png",
      spriteGrid: { rows: 1, cols: 1 },
    });

    sprite.pause();
    expect(useSceneStore.getState().views[sprite.id]!.isPlaying).toBe(false);

    sprite.play();
    expect(useSceneStore.getState().views[sprite.id]!.isPlaying).toBe(true);
  });

  it("reflects select/deselect transitions", () => {
    const sprite = render.creator.Sprite({
      position: new Vector(0, 0),
      src: "/x.png",
      spriteGrid: { rows: 1, cols: 1 },
    });

    sprite.emit("select", { target: sprite });
    expect(useSceneStore.getState().views[sprite.id]!.selected).toBe(true);

    sprite.emit("deselect", { target: sprite });
    expect(useSceneStore.getState().views[sprite.id]!.selected).toBe(false);
  });

  it("removes the sprite view on destroy", () => {
    const sprite = render.creator.Sprite({
      position: new Vector(0, 0),
      src: "/x.png",
      spriteGrid: { rows: 1, cols: 1 },
    });
    const id = sprite.id;

    sprite.destroy();

    const state = useSceneStore.getState();
    expect(state.sprites.find((s) => s.id === id)).toBeUndefined();
    expect(state.views[id]).toBeUndefined();
  });

  it("stops updating the store after detach", () => {
    detach();
    render.creator.Sprite({
      position: new Vector(0, 0),
      src: "/x.png",
      spriteGrid: { rows: 1, cols: 1 },
    });
    expect(useSceneStore.getState().sprites).toHaveLength(0);
  });

  it("backfills sprites that already exist on the render when attaching", () => {
    // Detach the beforeEach bridge, create a sprite with NO bridge listening,
    // then re-attach: the backfill must pick up the pre-existing sprite.
    detach();
    useSceneStore.getState().reset();

    const sprite = render.creator.Sprite({
      position: new Vector(0, 0),
      src: "/x.png",
      spriteGrid: { rows: 1, cols: 1 },
    });
    expect(useSceneStore.getState().sprites).toHaveLength(0);

    const detach2 = attachEngineBridge(render);
    expect(useSceneStore.getState().views[sprite.id]).toBeDefined();
    expect(useSceneStore.getState().sprites).toHaveLength(1);
    detach2();
  });

  it("only tracks Sprite instances (ignores other shapes)", () => {
    render.creator.Rect({ position: new Vector(0, 0), width: 10, height: 10 });
    const sprites = useSceneStore
      .getState()
      .sprites.filter((s) => s instanceof Sprite);
    expect(sprites).toHaveLength(0);
  });
});
