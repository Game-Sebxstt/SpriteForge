import { describe, it, expect, beforeEach } from "vitest";
import { ProjectStore, PROJECTS_KEY, LEGACY_KEY } from "@/lib/store/ProjectStore";
import type { ShapeRawData } from "@/lib/types/raw";

function legacyScene(): ShapeRawData[] {
  return [
    {
      id: "sprite-1",
      type: "sprite",
      position: { x: 10, y: 20 },
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
    } as unknown as ShapeRawData,
  ];
}

describe("ProjectStore named projects + migration (Phase 3 §3.2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates a legacy canvas blob into a 'Default' active project and keeps the backup", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyScene()));

    const data = ProjectStore.migrateIfNeeded();
    expect(data).toHaveLength(1);

    const list = ProjectStore.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("Default");
    expect(ProjectStore.getActiveId()).toBe(list[0]!.id);

    // Legacy key is preserved as a backup for one release.
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
    // The wrapper now exists.
    expect(localStorage.getItem(PROJECTS_KEY)).not.toBeNull();
  });

  it("creates an empty Default project when there is no legacy blob", () => {
    const data = ProjectStore.migrateIfNeeded();
    expect(data).toEqual([]);
    expect(ProjectStore.list()).toHaveLength(1);
    expect(ProjectStore.list()[0]!.name).toBe("Default");
  });

  it("is idempotent: a second migrate leaves the existing wrapper untouched", () => {
    ProjectStore.migrateIfNeeded();
    const firstId = ProjectStore.getActiveId();
    ProjectStore.migrateIfNeeded();
    expect(ProjectStore.getActiveId()).toBe(firstId);
    expect(ProjectStore.list()).toHaveLength(1);
  });

  it("saveActive writes through the active project only", () => {
    ProjectStore.migrateIfNeeded();
    ProjectStore.saveActive(legacyScene());
    expect(ProjectStore.getActiveData()).toHaveLength(1);
  });

  it("creates, switches, and deletes named projects without touching config", () => {
    localStorage.setItem("config", JSON.stringify({ setup: true }));
    ProjectStore.migrateIfNeeded();
    const defaultId = ProjectStore.getActiveId();

    const secondId = ProjectStore.createProject("Second", legacyScene());
    expect(ProjectStore.getActiveId()).toBe(secondId);
    expect(ProjectStore.list()).toHaveLength(2);

    ProjectStore.setActive(defaultId);
    expect(ProjectStore.getActiveId()).toBe(defaultId);

    ProjectStore.deleteProject(secondId);
    expect(ProjectStore.list().some((p) => p.id === secondId)).toBe(false);

    // config.setup survives all project operations (no demo reseed).
    expect(localStorage.getItem("config")).toBe(JSON.stringify({ setup: true }));
  });

  it("deleting the last project recreates a fresh Default", () => {
    ProjectStore.migrateIfNeeded();
    const id = ProjectStore.getActiveId();
    ProjectStore.deleteProject(id);
    const list = ProjectStore.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("Default");
  });
});
