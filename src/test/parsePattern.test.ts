import { describe, it, expect, beforeEach } from "vitest";
import { Render } from "@/lib/Render";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import { Vector } from "@/lib/common/Vector";

/**
 * Builds a Render with first-run demo sprites suppressed so a test can create
 * exactly the sprites it needs.
 */
function makeRender(): Render {
  localStorage.setItem("config", JSON.stringify({ setup: true }));
  const canvas = document.createElement("canvas");
  return new Render(canvas);
}

function parse(render: Render, pattern: string[], rows: number, cols: number): number[] {
  const sprite = new Sprite(
    {
      position: new Vector(0, 0),
      src: "/x.png",
      spriteGrid: { rows, cols },
      pattern,
    },
    render
  );
  // _processedFrames is populated from pattern in the constructor.
  return (sprite as unknown as { _processedFrames: number[] })._processedFrames;
}

describe("Sprite._parsePattern", () => {
  let render: Render;

  beforeEach(() => {
    render = makeRender();
  });

  it('parses a single frame "1"', () => {
    expect(parse(render, ["1"], 10, 10)).toEqual([1]);
  });

  it('parses an ascending range "6:12"', () => {
    expect(parse(render, ["6:12"], 10, 10)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });

  it('resolves "22:-1" to the last frame of the sheet', () => {
    // 5x5 => maxFrame 24
    expect(parse(render, ["22:-1"], 5, 5)).toEqual([22, 23, 24]);
  });

  it('repeats with "1(5)"', () => {
    expect(parse(render, ["1(5)"], 10, 10)).toEqual([1, 1, 1, 1, 1]);
  });

  it('expands "NxC" ("2x8") to C frames starting at N', () => {
    // 5x5 => maxFrame 24, no overflow
    expect(parse(render, ["2x8"], 5, 5)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('clamps "NxC" overflow to maxFrame ("2x8" on a 3x3 sheet)', () => {
    // 3x3 => maxFrame 8
    expect(parse(render, ["2x8"], 3, 3)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it('resolves N > maxFrame to the single clamped last frame', () => {
    // 3x3 => maxFrame 8, start 20 beyond sheet
    expect(parse(render, ["20x3"], 3, 3)).toEqual([8]);
  });

  it('does NOT silently fall through "2x8" to parseInt(2)', () => {
    const frames = parse(render, ["2x8"], 5, 5);
    expect(frames).not.toEqual([2]);
    expect(frames.length).toBeGreaterThan(1);
  });

  it('treats a combined token "2x8(3)" as the legacy single-frame fallback', () => {
    // Invalid combo => parseInt("2x8(3)") === 2
    expect(parse(render, ["2x8(3)"], 5, 5)).toEqual([2]);
  });

  it('counts down for a reverse range "12:6"', () => {
    expect(parse(render, ["12:6"], 10, 10)).toEqual([12, 11, 10, 9, 8, 7, 6]);
  });

  it('ping-pongs "6:12^" forward then back without repeating endpoints', () => {
    expect(parse(render, ["6:12^"], 10, 10)).toEqual([
      6, 7, 8, 9, 10, 11, 12, 11, 10, 9, 8, 7,
    ]);
  });
});
