import { describe, it, expect } from "vitest";
import { History } from "@/lib/common/History";

describe("History (undo/redo, Phase 3 §3.6)", () => {
  it("undoes and redoes a recorded command", () => {
    const history = new History();
    let value = 0;
    history.execute({ label: "inc", redo: () => (value = 1), undo: () => (value = 0) });

    expect(value).toBe(1);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    history.undo();
    expect(value).toBe(0);
    expect(history.canRedo()).toBe(true);

    history.redo();
    expect(value).toBe(1);
  });

  it("clears the redo tail when a new command is pushed after an undo", () => {
    const history = new History();
    let value = 0;
    history.execute({ label: "a", redo: () => (value = 1), undo: () => (value = 0) });
    history.undo();
    expect(history.canRedo()).toBe(true);

    history.execute({ label: "b", redo: () => (value = 2), undo: () => (value = 0) });
    expect(history.canRedo()).toBe(false);
    expect(value).toBe(2);
  });

  it("suppresses re-entrant pushes while applying", () => {
    const history = new History();
    let pushes = 0;
    history.execute({
      label: "reentrant",
      redo: () => {
        // Simulate an engine re-emitting a create during redo.
        history.push({ label: "nested", redo: () => pushes++, undo: () => pushes-- });
      },
      undo: () => {},
    });
    // The initial execute's push happens outside isApplying, so it counts; the
    // nested push during redo is suppressed.
    history.undo();
    history.redo();
    expect(pushes).toBe(0);
  });

  it("drops the oldest command past the bound", () => {
    const history = new History(2);
    history.execute({ label: "1", redo: () => {}, undo: () => {} });
    history.execute({ label: "2", redo: () => {}, undo: () => {} });
    history.execute({ label: "3", redo: () => {}, undo: () => {} });
    // Only the last two remain undoable.
    history.undo();
    history.undo();
    expect(history.canUndo()).toBe(false);
  });

  it("undo/redo on empty stacks are no-ops", () => {
    const history = new History();
    expect(() => history.undo()).not.toThrow();
    expect(() => history.redo()).not.toThrow();
  });
});
