import { describe, it, expect } from "vitest";
import { safeParseScene, parseScene } from "@/lib/export/sceneSchema";

const validSprite = {
  id: "s1",
  type: "sprite",
  position: { x: 0, y: 0 },
  rotation: 0,
  zIndex: 0,
  dragging: true,
  visible: true,
  src: "/a.png",
  spriteGrid: { rows: 1, cols: 1 },
  ignoreFrames: [],
  startFrame: 0,
  endFrame: 0,
  pattern: [],
  scale: 1,
  speed: 1,
  loop: true,
  isPlaying: true,
  isDebugged: false,
};

describe("scene schema validation (Phase 3 §3.1)", () => {
  it("accepts a valid scene array", () => {
    const result = safeParseScene([validSprite]);
    expect(result.ok).toBe(true);
  });

  it("accepts an optional fps field", () => {
    const result = safeParseScene([{ ...validSprite, fps: 24 }]);
    expect(result.ok).toBe(true);
  });

  it("rejects a non-array payload", () => {
    const result = safeParseScene({ not: "an array" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown shape type", () => {
    const result = safeParseScene([{ ...validSprite, type: "hologram" }]);
    expect(result.ok).toBe(false);
  });

  it("rejects a sprite missing required fields", () => {
    const { ...incomplete } = validSprite as Record<string, unknown>;
    delete incomplete.spriteGrid;
    const result = safeParseScene([incomplete]);
    expect(result.ok).toBe(false);
  });

  it("parseScene throws on invalid input", () => {
    expect(() => parseScene("garbage")).toThrow();
  });
});
