import { vi, beforeEach } from "vitest";

/**
 * Minimal mock of CanvasRenderingContext2D covering only the methods the engine
 * calls during update/draw. Every method is a no-op spy so tests can assert on
 * draw activity without a real canvas.
 */
function createMockContext(): CanvasRenderingContext2D {
  const ctx = {
    canvas: null as unknown as HTMLCanvasElement,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    rect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    measureText: vi.fn(() => ({
      width: 0,
      fontBoundingBoxAscent: 0,
      fontBoundingBoxDescent: 0,
    })),
    fillText: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    globalAlpha: 1,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

// Every canvas hands back the same kind of mock context.
HTMLCanvasElement.prototype.getContext = vi.fn(function (
  this: HTMLCanvasElement
) {
  const ctx = createMockContext();
  (ctx as unknown as { canvas: HTMLCanvasElement }).canvas = this;
  return ctx;
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// getBoundingClientRect returns a stable, non-zero box.
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 800,
  bottom: 600,
  width: 800,
  height: 600,
  toJSON: () => ({}),
})) as unknown as typeof HTMLCanvasElement.prototype.getBoundingClientRect;

// focus() is called by Render.setup(); jsdom supports it but keep it harmless.
HTMLCanvasElement.prototype.focus = vi.fn();

/* -------------------------------------------------------------------------- */
/* Manual-clock requestAnimationFrame / cancelAnimationFrame                   */
/* -------------------------------------------------------------------------- */

interface ScheduledFrame {
  id: number;
  cb: FrameRequestCallback;
}

const rafQueue: ScheduledFrame[] = [];
let rafId = 0;

/**
 * Runs every currently-scheduled rAF callback exactly once. Callbacks scheduled
 * during the flush are queued for the NEXT flush (mirrors a single tick), so a
 * self-rescheduling render loop advances one frame per call.
 */
export function flushAnimationFrame(now = performance.now()): void {
  const pending = rafQueue.splice(0, rafQueue.length);
  for (const frame of pending) {
    frame.cb(now);
  }
}

/** Number of rAF callbacks currently scheduled (i.e. live loops). */
export function scheduledFrameCount(): number {
  return rafQueue.length;
}

globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback): number => {
  const id = ++rafId;
  rafQueue.push({ id, cb });
  return id;
}) as unknown as typeof globalThis.requestAnimationFrame;

globalThis.cancelAnimationFrame = vi.fn((id: number): void => {
  const index = rafQueue.findIndex((f) => f.id === id);
  if (index > -1) rafQueue.splice(index, 1);
}) as unknown as typeof globalThis.cancelAnimationFrame;

/* -------------------------------------------------------------------------- */
/* localStorage stub                                                           */
/* -------------------------------------------------------------------------- */

class LocalStorageStub implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new LocalStorageStub(),
  writable: true,
  configurable: true,
});

/* -------------------------------------------------------------------------- */
/* Image: resolve load synchronously so Sprite._setup computes dimensions.     */
/* -------------------------------------------------------------------------- */

Object.defineProperty(HTMLImageElement.prototype, "src", {
  configurable: true,
  set(this: HTMLImageElement & { onload: (() => void) | null }, value: string) {
    this.setAttribute("src", value);
    // Give the image non-zero dimensions and fire onload on the next microtask.
    Object.defineProperty(this, "width", { configurable: true, value: 64 });
    Object.defineProperty(this, "height", { configurable: true, value: 64 });
    if (typeof this.onload === "function") {
      queueMicrotask(() => this.onload && this.onload());
    }
  },
  get(this: HTMLImageElement) {
    return this.getAttribute("src") ?? "";
  },
});

beforeEach(() => {
  // Isolate every test: empty storage, empty rAF queue, reset spies' call logs.
  (globalThis.localStorage as Storage).clear();
  rafQueue.splice(0, rafQueue.length);
  rafId = 0;
  vi.clearAllMocks();
});
