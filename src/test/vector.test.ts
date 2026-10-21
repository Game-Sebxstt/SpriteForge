import { describe, it, expect } from "vitest";
import { Vector } from "@/lib/common/Vector";

describe("Vector", () => {
  it("adds and subtracts component-wise", () => {
    const a = new Vector(1, 2);
    const b = new Vector(3, 5);
    expect(a.add(b)).toEqual(new Vector(4, 7));
    expect(b.sub(a)).toEqual(new Vector(2, 3));
  });

  it("scales by a scalar", () => {
    expect(new Vector(2, -3).scale(2)).toEqual(new Vector(4, -6));
  });

  it("normalizes to unit length", () => {
    const n = new Vector(0, 5).normalize();
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
    expect(n.len()).toBeCloseTo(1);
  });

  it("exposes the canonical direction vectors", () => {
    expect(Vector.zero).toEqual(new Vector(0, 0));
    expect(Vector.up).toEqual(new Vector(0, -1));
    expect(Vector.down).toEqual(new Vector(0, 1));
    expect(Vector.left).toEqual(new Vector(-1, 0));
    expect(Vector.right).toEqual(new Vector(1, 0));
  });

  it("pins the zero-vector normalize edge case as (NaN, NaN) (no code change)", () => {
    const n = Vector.zero.normalize();
    expect(Number.isNaN(n.x)).toBe(true);
    expect(Number.isNaN(n.y)).toBe(true);
    expect(n.isNaN()).toBe(true);
  });

  it("clones to an independent instance", () => {
    const a = new Vector(7, 8);
    const c = a.clone();
    c.x = 99;
    expect(a.x).toBe(7);
  });
});
