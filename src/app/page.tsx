"use client"

import { useApp } from "@/hooks/useApp";
import { useEffect, useRef } from "react";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import BottomPanel from "@/components/client/BottomPanel";
import FloatingToolbar from "@/components/client/FloatingToolbar";
import { FloatingGitHubButton } from "@/components/client/FloatingGitHubButton";
import ControllerModal from "@/components/client/ControllerModal";
import NoticeHost from "@/components/client/NoticeHost";
import { useSceneStore } from "@/lib/store/useSceneStore";
import { attachEngineBridge } from "@/lib/store/engineBridge";
import { exportSceneJSON, importSceneJSON } from "@/lib/export/exporters";
import type { SpriteProps } from "@/lib/types/Shape";
import type { RenderEventMouseMove } from "@/lib/types/RenderProvider";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setup, render } = useApp();

  const isPlaying = useSceneStore((s) => s.isPlaying);
  const setIsPlaying = useSceneStore((s) => s.setIsPlaying);
  const isControllerModalOpen = useSceneStore((s) => s.isControllerModalOpen);
  const selectedSpriteForController = useSceneStore((s) => s.selectedSpriteForController);

  useEffect(() => {
    if (!canvasRef.current) return;
    return setup(canvasRef.current);
  }, [canvasRef]);

  // Single engine<->store bridge: subscribes once to create/select/deselect/
  // play/pause/destroy and writes view-models into the scene store.
  useEffect(() => {
    if (!render) return;

    const detach = attachEngineBridge(render);
    // Load the active named project, running the one-time legacy->projects
    // migration first (Phase 3 §3.2).
    render.loadActiveProject();

    return () => {
      detach();
    };
  }, [render]);

  // Undo/redo keyboard shortcuts (Phase 3 §3.6): Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z.
  useEffect(() => {
    if (!render) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) render.redo();
      else render.undo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [render]);

  // Single render-loop lifecycle owner: the toolbar flips isPlaying, this
  // effect is the only caller of start()/stop().
  useEffect(() => {
    if (!render) return;
    if (isPlaying) render.start();
    else render.stop();
  }, [isPlaying, render]);

  // User-visible behavior (shapes chase the cursor): preserved verbatim.
  useEffect(() => {
    if (!render) return;

    const onMouseMove = (args: RenderEventMouseMove) => {
      render.childrens.forEach(child => {
        if (!child.bodyVelocity) return;
        child.bodyVelocity.direction = args.pointer.relative.sub(child.position).normalize();
        child.bodyVelocity.speed = 5;
      })
    }

    render.on("mousemove", onMouseMove);

    return () => {
      render.off("mousemove", onMouseMove);
    };
  }, [render]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handleStop = () => {
    setIsPlaying(false);
  };

  const handleDeleteSprite = (spriteToDelete: Sprite) => {
    if (!render) return;
    // Capture raw data BEFORE destroying so delete is undoable (Phase 3 §3.6).
    const snapshot = spriteToDelete._rawData();
    spriteToDelete.destroy();
    render.recordDelete(snapshot);
  };

  const handleCreateSprite = (props: SpriteProps) => {
    if (!render) return;
    const sprite = render.creator.Sprite(props);
    render.recordCreate(sprite);
  };

  const handleUndo = () => {
    render?.undo();
  };

  const handleRedo = () => {
    render?.redo();
  };

  const handleExportScene = () => {
    if (!render) return;
    exportSceneJSON(render);
  };

  const handleImportScene = (file: File) => {
    if (!render) return;
    const reader = new FileReader();
    reader.onload = () => {
      importSceneJSON(render, String(reader.result ?? ""));
    };
    reader.readAsText(file);
  };

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
      <canvas 
        ref={canvasRef} 
        id="canvas" 
        className="w-full h-full"
        role="application"
        aria-label="Sprite animation canvas. Use the toolbar to create sprites and the bottom panel to control playback. A bound sprite is moved with its configured keyboard keys (default WASD to move, Space to jump)."
      />
      
      <FloatingToolbar 
        onCreateSprite={handleCreateSprite}
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onStop={handleStop}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExportScene={handleExportScene}
        onImportScene={handleImportScene}
      />
      <BottomPanel
        onDeleteSprite={handleDeleteSprite}
      />

      <FloatingGitHubButton url="https://github.com/GarcesSebastian/sprite-tools" />

      {isControllerModalOpen && selectedSpriteForController && (
        <ControllerModal/>
      )}

      <NoticeHost />
    </div>
  );
}
