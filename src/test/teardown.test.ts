import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Render } from "@/lib/Render";
import { Controller } from "@/lib/common/Controller";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import { Vector } from "@/lib/common/Vector";
import { flushAnimationFrame, scheduledFrameCount } from "./setup";

interface ListenerRecord {
  type: string;
  listener: EventListenerOrEventListenerObject;
}

/**
 * Installs spies on EventTarget.prototype add/removeEventListener so window,
 * document and canvas listeners are all captured, returning collected records
 * and a restore function.
 */
function spyListeners() {
  const added: ListenerRecord[] = [];
  const removed: ListenerRecord[] = [];

  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;

  const addSpy = vi
    .spyOn(EventTarget.prototype, "addEventListener")
    .mockImplementation(function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      if (listener) added.push({ type, listener });
      return origAdd.call(this, type, listener, options);
    });

  const removeSpy = vi
    .spyOn(EventTarget.prototype, "removeEventListener")
    .mockImplementation(function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions
    ) {
      if (listener) removed.push({ type, listener });
      return origRemove.call(this, type, listener, options);
    });

  return {
    added,
    removed,
    restore: () => {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    },
  };
}

/** True if every (type, listener) added also appears in the removed list. */
function allBalanced(added: ListenerRecord[], removed: ListenerRecord[]): boolean {
  return added.every((a) =>
    removed.some((r) => r.type === a.type && r.listener === a.listener)
  );
}

function makeRenderWithController(): {
  render: Render;
  offSpy: ReturnType<typeof vi.spyOn>;
} {
  localStorage.setItem("config", JSON.stringify({ setup: true }));
  const canvas = document.createElement("canvas");
  const render = new Render(canvas);

  const offSpy = vi.spyOn(render, "off");

  // A bound controller (adds its 2 document listeners).
  const sprite = new Sprite(
    {
      position: new Vector(0, 0),
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
    },
    render
  );
  controller.bind(sprite);

  return { render, offSpy };
}

describe("Render teardown / listener balance", () => {
  let spies: ReturnType<typeof spyListeners>;

  beforeEach(() => {
    spies = spyListeners();
  });

  afterEach(() => {
    spies.restore();
  });

  it("removes every DOM listener it added and tears down the loop", () => {
    const { render, offSpy } = makeRenderWithController();
    render.start();

    expect(scheduledFrameCount()).toBe(1);

    render.destroy();

    // Every window/document/canvas add has a same-reference remove.
    expect(allBalanced(spies.added, spies.removed)).toBe(true);

    // cancelAnimationFrame was invoked and no loop remains scheduled.
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(scheduledFrameCount()).toBe(0);

    // The Transformer's eight emitter subscriptions were unsubscribed via off().
    const transformerEvents = [
      "click", "touch", "mousedown", "mousemove",
      "mouseup", "touchstart", "touchmove", "touchend",
    ];
    const offEvents = offSpy.mock.calls.map((c) => c[0]);
    for (const ev of transformerEvents) {
      expect(offEvents).toContain(ev);
    }

    // Advancing the clock after destroy schedules no further draws.
    flushAnimationFrame();
    expect(scheduledFrameCount()).toBe(0);
  });

  it("does not grow listener counts across a second mount+destroy and keeps one loop", () => {
    const first = makeRenderWithController();
    first.render.start();
    expect(scheduledFrameCount()).toBe(1);
    first.render.destroy();
    expect(scheduledFrameCount()).toBe(0);

    const addedAfterFirst = spies.added.length;
    const removedAfterFirst = spies.removed.length;

    const second = makeRenderWithController();
    second.render.start();

    // Exactly one rAF loop is live while mounted (single start owner).
    expect(scheduledFrameCount()).toBe(1);

    second.render.destroy();

    // The second cycle added the same number of listeners as the first and
    // balanced them all (no accumulation / orphaned Transformer subscriptions).
    const secondAdded = spies.added.length - addedAfterFirst;
    const secondRemoved = spies.removed.length - removedAfterFirst;
    expect(secondAdded).toBe(addedAfterFirst);
    expect(secondRemoved).toBe(removedAfterFirst);
    expect(allBalanced(spies.added, spies.removed)).toBe(true);
    expect(scheduledFrameCount()).toBe(0);
  });
});
