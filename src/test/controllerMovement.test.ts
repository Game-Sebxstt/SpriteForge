import { describe, it, expect, beforeEach, vi } from "vitest";
import { Render } from "@/lib/Render";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import { Controller } from "@/lib/common/Controller";
import { Vector } from "@/lib/common/Vector";

function makeRender(): Render {
  localStorage.setItem("config", JSON.stringify({ setup: true }));
  const canvas = document.createElement("canvas");
  const render = new Render(canvas);
  // Keep the hot path off real localStorage writes during ticks.
  render.autoSave = vi.fn();
  render.flushSave = vi.fn();
  return render;
}

function makeControlledSprite(render: Render): { sprite: Sprite; controller: Controller } {
  const sprite = new Sprite(
    {
      position: new Vector(100, 100),
      src: "/x.png",
      spriteGrid: { rows: 4, cols: 4 },
    },
    render
  );
  (sprite as unknown as { _loading: boolean })._loading = false;

  const controller = new Controller(
    {
      keywords: { up: "w", down: "s", left: "a", right: "d", jump: " " },
      status: {
        up: ["0"], down: ["0"], left: ["0"], right: ["0"],
        jump: ["0"], fall: ["0"], idle: ["0"],
      },
      speed: 5,
    },
    render
  );
  controller.bind(sprite);
  return { sprite, controller };
}

/** Sets the controller's private pressed-key set. */
function pressKey(controller: Controller, key: string): void {
  (controller as unknown as { _keysPressed: Set<string> })._keysPressed.add(key);
}

/** Sets the controller's private on-ground flag. */
function setOnGround(controller: Controller, value: boolean): void {
  (controller as unknown as { _isOnGround: boolean })._isOnGround = value;
}

/**
 * Keeps the controller airborne across ticks by placing its recorded ground
 * position far below, so _updatePhysics' landing check never flips _isOnGround
 * back to true (isolates the _updateMovement horizontal guard under test).
 */
function keepAirborne(controller: Controller): void {
  (controller as unknown as { _lastPosition: Vector })._lastPosition = new Vector(0, 100000);
  (controller as unknown as { _velocity: Vector })._velocity = new Vector(0, -1);
}

describe("Controller movement precedence (BUG-4)", () => {
  let render: Render;

  beforeEach(() => {
    render = makeRender();
  });

  it("does NOT move horizontally while airborne (_isOnGround = false)", () => {
    const { sprite, controller } = makeControlledSprite(render);
    const startX = sprite.position.x;

    setOnGround(controller, false);
    keepAirborne(controller);
    pressKey(controller, "d"); // right

    for (let i = 0; i < 5; i++) controller.tick();

    expect(sprite.position.x).toBeCloseTo(startX);
  });

  it("moves horizontally while on the ground (_isOnGround = true)", () => {
    const { sprite, controller } = makeControlledSprite(render);
    const startX = sprite.position.x;

    setOnGround(controller, true);
    pressKey(controller, "d"); // right

    controller.tick();

    expect(sprite.position.x).toBeGreaterThan(startX);
  });
});
