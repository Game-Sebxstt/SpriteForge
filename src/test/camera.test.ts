import { describe, it, expect } from "vitest";
import { Camera } from "@/lib/common/Camera";

describe("Camera (zoom & pan, Phase 3 §3.7)", () => {
  it("is identity by default (screen == world)", () => {
    const camera = new Camera();
    const world = camera.screenToWorld(100, 50);
    expect(world.x).toBe(100);
    expect(world.y).toBe(50);
  });

  it("round-trips screen<->world at arbitrary pan/zoom", () => {
    const camera = new Camera();
    camera.x = 40;
    camera.y = -25;
    camera.scale = 2;

    const world = camera.screenToWorld(240, 75);
    const screen = camera.worldToScreen(world.x, world.y);
    expect(screen.x).toBeCloseTo(240);
    expect(screen.y).toBeCloseTo(75);
  });

  it("panBy moves the screen offset without touching scale", () => {
    const camera = new Camera();
    camera.panBy(30, -10);
    expect(camera.x).toBe(30);
    expect(camera.y).toBe(-10);
    expect(camera.scale).toBe(1);
  });

  it("keeps the world point under the cursor fixed when zooming", () => {
    const camera = new Camera();
    const focusX = 300;
    const focusY = 200;
    const worldBefore = camera.screenToWorld(focusX, focusY);

    camera.zoomAt(2, focusX, focusY);

    const worldAfter = camera.screenToWorld(focusX, focusY);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y);
    expect(camera.scale).toBe(2);
  });

  it("clamps zoom to the camera limits", () => {
    const camera = new Camera();
    for (let i = 0; i < 100; i++) camera.zoomAt(2, 0, 0);
    expect(camera.scale).toBeLessThanOrEqual(Camera.MAX_SCALE);

    for (let i = 0; i < 100; i++) camera.zoomAt(0.5, 0, 0);
    expect(camera.scale).toBeGreaterThanOrEqual(Camera.MIN_SCALE);
  });

  it("reset returns to identity", () => {
    const camera = new Camera();
    camera.x = 10;
    camera.y = 20;
    camera.scale = 3;
    camera.reset();
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    expect(camera.scale).toBe(1);
  });
});
