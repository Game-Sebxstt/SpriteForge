import { describe, it, expect, beforeEach } from "vitest";
import { Render } from "@/lib/Render";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import { Vector } from "@/lib/common/Vector";
import type { SpriteRawData } from "@/lib/types/raw";

function makeRender(): Render {
  localStorage.setItem("config", JSON.stringify({ setup: true }));
  const canvas = document.createElement("canvas");
  return new Render(canvas);
}

describe("serialize -> deserialize round-trip", () => {
  let render: Render;

  beforeEach(() => {
    render = makeRender();
  });

  it("preserves a sprite's raw data across a JSON round-trip (snapshot vs snapshot)", () => {
    // Build the fixture through the construction path that sets _patternBackup
    // (pass pattern at construction so _patternBackup === pattern).
    const sprite = new Sprite(
      {
        position: new Vector(120, 240),
        src: "/assets/Warrior/sprite.png",
        spriteGrid: { rows: 4, cols: 4 },
        pattern: ["0:3"],
        scale: 2,
        speed: 1.5,
        loop: true,
      },
      render
    );
    render.emit("create", { shape: sprite });
    sprite.setDebug(true);
    sprite.play();

    const original = sprite._rawData();

    // JSON round-trip of the whole scene serialization.
    const serialized = render.serialize();
    const roundTripped: SpriteRawData[] = JSON.parse(JSON.stringify(serialized));

    // Rebuild into a fresh render and compare snapshot-vs-snapshot.
    const render2 = makeRender();
    render2.deserialize(roundTripped);
    const rebuilt = [...render2.childrens.values()].find(
      (c) => c instanceof Sprite
    ) as Sprite;

    expect(rebuilt).toBeDefined();
    expect(rebuilt._rawData()).toEqual(original);
  });

  it("round-trips a sprite that carries a controller", () => {
    const sprite = new Sprite(
      {
        position: new Vector(10, 20),
        src: "/assets/Warrior/character.png",
        spriteGrid: { rows: 4, cols: 4 },
        pattern: ["0:3"],
      },
      render
    );
    render.emit("create", { shape: sprite });
    sprite.manager.controller({
      keywords: { up: "w", down: "s", left: "a", right: "d", jump: " " },
      status: {
        up: ["4:7"],
        down: ["0:3"],
        left: ["12:15"],
        right: ["8:11"],
        jump: ["4"],
        fall: ["8"],
        idle: ["0"],
      },
      speed: 5,
    });

    const original = sprite._rawData();
    expect(original.controller).toBeDefined();

    const roundTripped: SpriteRawData[] = JSON.parse(
      JSON.stringify(render.serialize())
    );
    const render2 = makeRender();
    render2.deserialize(roundTripped);
    const rebuilt = [...render2.childrens.values()].find(
      (c) => c instanceof Sprite
    ) as Sprite;

    expect(rebuilt._rawData().controller).toEqual(original.controller);
  });
});
