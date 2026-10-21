import { create } from "zustand";
import type { Sprite } from "@/lib/instances/_shapes/Sprite";

/**
 * Lightweight, serializable UI projection of a single sprite's engine state.
 * The engine remains the owner of truth; these are read-model fields the panel
 * renders and that only change on discrete transitions (play/pause, controller
 * bind, property edits) — never per animation frame.
 */
export interface SpriteView {
    isPlaying: boolean;
    speed: number;
    loop: boolean;
    debug: boolean;
    hasController: boolean;
    isControlled: boolean;
    selected: boolean;
    /** Per-sprite FPS (Phase 3 §3.3); undefined means legacy cadence. */
    fps: number | undefined;
    /** Onion-skin toggle (Phase 3 §3.4); view-only. */
    onionSkin: boolean;
}

/**
 * Builds a {@link SpriteView} snapshot from a live sprite plus the currently
 * controlled sprite (bind state lives on the engine, not the sprite).
 */
export function viewFromSprite(sprite: Sprite, controlled: Sprite | null): SpriteView {
    return {
        isPlaying: sprite.isPlaying(),
        speed: sprite.speed ?? 1,
        loop: sprite.loop ?? false,
        debug: sprite.debug,
        hasController: sprite.controller !== null,
        isControlled: controlled === sprite,
        selected: false,
        fps: sprite.fps,
        onionSkin: sprite.isOnionSkin(),
    };
}

interface SceneState {
    /** Ordered list of live sprites (the single source the panel maps over). */
    sprites: Sprite[];
    /** Per-sprite UI view-models keyed by sprite id. */
    views: Record<string, SpriteView>;

    /** Global play/stop flag — the single owner of the render loop lifecycle. */
    isPlaying: boolean;
    /** Whether the controller editor modal is open. */
    isControllerModalOpen: boolean;
    /** The sprite the controller modal is editing/creating a controller for. */
    selectedSpriteForController: Sprite | null;
    /** The sprite currently bound to its controller (keyboard-driven). */
    spriteControlled: Sprite | null;

    /** Adds a sprite and seeds its view-model. */
    addSprite: (sprite: Sprite) => void;
    /** Removes a sprite and its view-model. */
    removeSprite: (id: string) => void;
    /** Merges partial fields into a sprite's view-model. */
    patchView: (id: string, patch: Partial<SpriteView>) => void;
    /** Sets a sprite's selected flag. */
    setSelected: (id: string, selected: boolean) => void;

    setIsPlaying: (value: boolean) => void;
    setIsControllerModalOpen: (value: boolean) => void;
    setSelectedSpriteForController: (sprite: Sprite | null) => void;
    setSpriteControlled: (sprite: Sprite | null) => void;

    /** Clears all scene state (used on engine teardown). */
    reset: () => void;
}

export const useSceneStore = create<SceneState>((set) => ({
    sprites: [],
    views: {},

    isPlaying: true,
    isControllerModalOpen: false,
    selectedSpriteForController: null,
    spriteControlled: null,

    addSprite: (sprite) =>
        set((state) => {
            if (state.views[sprite.id]) return state;
            return {
                sprites: [...state.sprites, sprite],
                views: {
                    ...state.views,
                    [sprite.id]: viewFromSprite(sprite, state.spriteControlled),
                },
            };
        }),

    removeSprite: (id) =>
        set((state) => {
            if (!state.views[id]) return state;
            const views = { ...state.views };
            delete views[id];
            return {
                sprites: state.sprites.filter((s) => s.id !== id),
                views,
            };
        }),

    patchView: (id, patch) =>
        set((state) => {
            const current = state.views[id];
            if (!current) return state;
            return { views: { ...state.views, [id]: { ...current, ...patch } } };
        }),

    setSelected: (id, selected) =>
        set((state) => {
            const current = state.views[id];
            if (!current) return state;
            return { views: { ...state.views, [id]: { ...current, selected } } };
        }),

    setIsPlaying: (value) => set({ isPlaying: value }),
    setIsControllerModalOpen: (value) => set({ isControllerModalOpen: value }),
    setSelectedSpriteForController: (sprite) => set({ selectedSpriteForController: sprite }),
    setSpriteControlled: (sprite) => set({ spriteControlled: sprite }),

    reset: () =>
        set({
            sprites: [],
            views: {},
            selectedSpriteForController: null,
            spriteControlled: null,
        }),
}));
