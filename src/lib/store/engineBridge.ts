import { Render } from "@/lib/Render";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import { useSceneStore, viewFromSprite } from "./useSceneStore";
import type { RenderEventCreate } from "@/lib/types/RenderProvider";

/**
 * Bridges engine events into the Zustand scene store. This is the single place
 * that subscribes to the `Render`/`Shape` emitters for sprite tracking,
 * replacing the hand-rolled `on/off` arrays + `forceUpdate({})` in `page.tsx`.
 *
 * The engine stays the owner of truth; this bridge only writes serializable
 * view-models on discrete transitions (create/select/deselect/play/pause/
 * destroy), never per animation frame.
 *
 * @param render - The live render instance to bind to.
 * @returns A cleanup function that detaches every subscription it registered.
 */
export function attachEngineBridge(render: Render): () => void {
    const store = useSceneStore.getState;

    // Per-sprite handler references, kept so off() can match by reference.
    const spriteHandlers = new Map<
        string,
        {
            onSelect: () => void;
            onDeselect: () => void;
            onPlay: () => void;
            onPause: () => void;
            onDestroy: () => void;
            sprite: Sprite;
        }
    >();

    const detachSprite = (id: string) => {
        const handlers = spriteHandlers.get(id);
        if (!handlers) return;
        handlers.sprite.off("select", handlers.onSelect);
        handlers.sprite.off("deselect", handlers.onDeselect);
        handlers.sprite.off("play", handlers.onPlay);
        handlers.sprite.off("pause", handlers.onPause);
        handlers.sprite.off("destroy", handlers.onDestroy);
        spriteHandlers.delete(id);
    };

    const onCreate = (args: RenderEventCreate) => {
        if (!(args.shape instanceof Sprite)) return;
        const sprite = args.shape;

        store().addSprite(sprite);

        const onSelect = () => store().setSelected(sprite.id, true);
        const onDeselect = () => store().setSelected(sprite.id, false);
        const onPlay = () => store().patchView(sprite.id, { isPlaying: true });
        const onPause = () => store().patchView(sprite.id, { isPlaying: false });
        const onDestroy = () => {
            detachSprite(sprite.id);
            store().removeSprite(sprite.id);
            if (store().spriteControlled === sprite) {
                store().setSpriteControlled(null);
            }
        };

        sprite.on("select", onSelect);
        sprite.on("deselect", onDeselect);
        sprite.on("play", onPlay);
        sprite.on("pause", onPause);
        sprite.on("destroy", onDestroy);

        spriteHandlers.set(sprite.id, {
            onSelect,
            onDeselect,
            onPlay,
            onPause,
            onDestroy,
            sprite,
        });
    };

    render.on("create", onCreate);

    // Backfill any sprites that already exist on the render (e.g. first-run demo
    // sprites created in the Render constructor, before this bridge attached) so
    // the panel reflects them without waiting for a reload.
    for (const shape of render.childrens.values()) {
        if (shape instanceof Sprite && !spriteHandlers.has(shape.id)) {
            onCreate({ shape });
        }
    }

    return () => {
        render.off("create", onCreate);
        for (const id of [...spriteHandlers.keys()]) {
            detachSprite(id);
        }
        useSceneStore.getState().reset();
    };
}

export { viewFromSprite };
