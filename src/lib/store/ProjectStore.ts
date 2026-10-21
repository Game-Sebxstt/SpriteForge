import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import type { ShapeRawData } from "../types/raw";
import { sceneSchema } from "../export/sceneSchema";

/**
 * Named multi-project persistence (Phase 3 §3.2).
 *
 * BREAKING vs the single `localStorage["canvas"]` slot: scenes now live under
 * {@link PROJECTS_KEY} as a versioned wrapper of named projects, each holding a
 * `ShapeRawData[]` produced/consumed by the UNCHANGED `serialize`/`deserialize`
 * contract. A one-time automatic migration wraps a pre-existing legacy `canvas`
 * blob as a project named "Default" and keeps the legacy key as a backup for one
 * release. See {@link migrateIfNeeded}.
 */

/** localStorage key holding the versioned named-projects wrapper. */
export const PROJECTS_KEY = "spriteforge.projects";
/** Legacy single-slot key, preserved as a migration backup for one release. */
export const LEGACY_KEY = "canvas";
/** Current wrapper schema version. */
export const PROJECTS_VERSION = 1;

/** A single named project and its serialized scene. */
export interface Project {
    name: string;
    data: ShapeRawData[];
}

/** The versioned wrapper stored under {@link PROJECTS_KEY}. */
export interface ProjectsFile {
    version: number;
    active: string;
    projects: Record<string, Project>;
}

const projectSchema = z.object({
    name: z.string(),
    data: sceneSchema,
});

const projectsFileSchema = z.object({
    version: z.number(),
    active: z.string(),
    projects: z.record(z.string(), projectSchema),
});

/**
 * Reads and validates the projects wrapper, or returns null when absent/invalid.
 */
function readFile(): ProjectsFile | null {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return null;
    try {
        const parsed = projectsFileSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) return null;
        return parsed.data as unknown as ProjectsFile;
    } catch {
        return null;
    }
}

/** Writes the wrapper back to storage (scoped setItem, never a global clear). */
function writeFile(file: ProjectsFile): void {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(file));
}

/**
 * Store for the named-projects wrapper. All writes are scoped `setItem`/
 * `removeItem` of the project keys only — never `localStorage.clear()` — so
 * `config.setup` and unrelated keys are preserved (this is what keeps the
 * first-run demo-sprite reseed from firing after a clear).
 */
export const ProjectStore = {
    PROJECTS_KEY,
    LEGACY_KEY,
    PROJECTS_VERSION,

    /**
     * Runs the one-time legacy→projects migration if needed, guaranteeing a
     * valid wrapper with an active project afterwards.
     *
     * - If a valid wrapper already exists, it is left untouched.
     * - Else if a legacy `canvas` blob exists, it is wrapped as "Default",
     *   set active, and the legacy key is KEPT as a backup for one release.
     * - Else a fresh empty "Default" project is created.
     *
     * @returns The active project's scene data (possibly empty).
     */
    migrateIfNeeded(): ShapeRawData[] {
        const existing = readFile();
        if (existing && existing.projects[existing.active]) {
            return existing.projects[existing.active]!.data;
        }

        // Attempt to adopt a legacy single-slot scene as "Default".
        let legacy: ShapeRawData[] = [];
        const legacyRaw = localStorage.getItem(LEGACY_KEY);
        if (legacyRaw) {
            try {
                const parsed = sceneSchema.safeParse(JSON.parse(legacyRaw));
                if (parsed.success) legacy = parsed.data as unknown as ShapeRawData[];
            } catch {
                legacy = [];
            }
        }

        const id = uuidv4();
        const file: ProjectsFile = {
            version: PROJECTS_VERSION,
            active: id,
            projects: {
                [id]: { name: "Default", data: legacy },
            },
        };
        writeFile(file);
        // The legacy key is intentionally NOT removed (backup for one release).
        return legacy;
    },

    /** Returns the validated wrapper, running migration first if necessary. */
    getFile(): ProjectsFile {
        this.migrateIfNeeded();
        return readFile()!;
    },

    /** Returns the active project id. */
    getActiveId(): string {
        return this.getFile().active;
    },

    /** Returns a shallow list of `{ id, name }` for every project. */
    list(): Array<{ id: string; name: string }> {
        const file = this.getFile();
        return Object.entries(file.projects).map(([id, p]) => ({ id, name: p.name }));
    },

    /** Returns the active project's scene data. */
    getActiveData(): ShapeRawData[] {
        const file = this.getFile();
        return file.projects[file.active]?.data ?? [];
    },

    /**
     * Writes `data` into the ACTIVE project (scoped). Used by `Render.autoSave`'s
     * underlying write so the serialization contract is unchanged — only the key/
     * wrapper differs.
     */
    saveActive(data: ShapeRawData[]): void {
        const file = this.getFile();
        const active = file.projects[file.active];
        if (!active) return;
        active.data = data;
        writeFile(file);
    },

    /** Sets the active project by id (no-op if the id is unknown). */
    setActive(id: string): void {
        const file = this.getFile();
        if (!file.projects[id]) return;
        file.active = id;
        writeFile(file);
    },

    /**
     * Creates a new named project and makes it active.
     * @param name - Display name.
     * @param data - Optional initial scene (defaults to empty).
     * @returns The new project's id.
     */
    createProject(name: string, data: ShapeRawData[] = []): string {
        const file = this.getFile();
        const id = uuidv4();
        file.projects[id] = { name, data };
        file.active = id;
        writeFile(file);
        return id;
    },

    /** Renames a project in place (no-op if unknown). */
    renameProject(id: string, name: string): void {
        const file = this.getFile();
        const project = file.projects[id];
        if (!project) return;
        project.name = name;
        writeFile(file);
    },

    /**
     * Deletes a single project by scoped removal of its own entry only. If the
     * active project is deleted, the active pointer falls back to another
     * project, creating a fresh "Default" when none remain. Never touches
     * `config` or unrelated keys.
     */
    deleteProject(id: string): void {
        const file = this.getFile();
        if (!file.projects[id]) return;
        delete file.projects[id];

        if (file.active === id) {
            const remaining = Object.keys(file.projects);
            if (remaining.length > 0) {
                file.active = remaining[0]!;
            } else {
                const newId = uuidv4();
                file.projects[newId] = { name: "Default", data: [] };
                file.active = newId;
            }
        }
        writeFile(file);
    },
};
