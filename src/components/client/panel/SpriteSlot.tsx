"use client"

import { useState } from "react";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import { Button, Select, Range } from "@/components/common";
import { useSceneStore } from "@/lib/store/useSceneStore";
import { exportSheetPNG, exportAnimated } from "@/lib/export/exporters";

interface SpriteSlotProps {
  sprite: Sprite;
  isSelected: boolean;
  onDelete: (sprite: Sprite) => void;
}

export default function SpriteSlot({
  sprite,
  isSelected,
  onDelete,
}: SpriteSlotProps) {
  const view = useSceneStore((s) => s.views[sprite.id]);
  const spriteControlled = useSceneStore((s) => s.spriteControlled);
  const setSpriteControlled = useSceneStore((s) => s.setSpriteControlled);
  const setIsControllerModalOpen = useSceneStore((s) => s.setIsControllerModalOpen);
  const setSelectedSpriteForController = useSceneStore((s) => s.setSelectedSpriteForController);
  const patchView = useSceneStore((s) => s.patchView);

  // View-model fields (reflect the engine on discrete transitions).
  const isPlaying = view?.isPlaying ?? sprite.isPlaying();
  const speed = view?.speed ?? sprite.speed ?? 1;
  const loop = view?.loop ?? sprite.loop ?? false;
  const debug = view?.debug ?? sprite.debug;
  const hasController = view?.hasController ?? (sprite.controller !== null);
  const isControlled = spriteControlled === sprite;
  const fps = view?.fps ?? sprite.fps;
  const onionSkin = view?.onionSkin ?? sprite.isOnionSkin();

  // Frame scrubber (Phase 3 §3.4): local index state, applied to the engine
  // while paused. Re-reads the sprite's frame count each render.
  const frameCount = sprite.getFrameCount();
  const [scrubIndex, setScrubIndex] = useState<number>(sprite.getFrameIndex());

  const handleTogglePlay = () => {
    if (sprite.isPlaying()) {
      sprite.pause();
    } else {
      sprite.play();
    }
    // play/pause emit events handled by the bridge; nothing else needed.
  };

  const handleSpeedChange = (value: number) => {
    sprite.setSpeed(value);
    patchView(sprite.id, { speed: value });
  };

  const handleDelete = () => {
    onDelete(sprite);
  };

  const handleDebugToggle = () => {
    sprite.setDebug(!sprite.debug);
    patchView(sprite.id, { debug: sprite.debug });
  };

  const handleLoopToggle = () => {
    sprite.setLoop(!sprite.loop);
    patchView(sprite.id, { loop: sprite.loop ?? false });
  };

  const handleControllerToggle = () => {
    if (sprite.controller) {
      sprite._restorePattern();
      sprite.controller.destroy();
      sprite.controller = null;
      if (spriteControlled === sprite) setSpriteControlled(null);
      patchView(sprite.id, { hasController: false, isControlled: false });
    } else {
      setIsControllerModalOpen(true);
      setSelectedSpriteForController(sprite);
    }
  };

  const handleEditController = () => {
    setIsControllerModalOpen(true);
    setSelectedSpriteForController(sprite);
  };

  const handleControllerBindToggle = () => {
    if (!sprite.controller) return;

    const isCurrentlyControlled = spriteControlled === sprite;

    if (isCurrentlyControlled) {
      sprite.controller.unbind();
      setSpriteControlled(null);
    } else {
      if (spriteControlled && spriteControlled.controller) {
        spriteControlled.controller.unbind();
      }

      sprite.controller.bind(sprite);
      setSpriteControlled(sprite);
    }
  };

  const handleFpsChange = (value: string) => {
    const fpsValue = value === "default" ? undefined : parseInt(value, 10);
    sprite.setFps(fpsValue);
    patchView(sprite.id, { fps: fpsValue });
  };

  const handleOnionToggle = () => {
    sprite.setOnionSkin(!sprite.isOnionSkin());
    patchView(sprite.id, { onionSkin: sprite.isOnionSkin() });
  };

  const handleScrub = (value: number) => {
    setScrubIndex(value);
    if (sprite.isPlaying()) sprite.pause();
    sprite.setFrameIndex(value);
  };

  const handleExportSheet = () => {
    void exportSheetPNG(sprite, `sprite-${sprite.id}-sheet.png`);
  };

  const handleExportWebp = () => {
    void exportAnimated(sprite, "webp", fps ?? 12, `sprite-${sprite.id}.webm`);
  };

  const handleExportApng = () => {
    void exportAnimated(sprite, "apng", fps ?? 12, `sprite-${sprite.id}.png`);
  };

  return (
    <div 
      className={`
        relative flex-shrink-0 w-full min-h-full bg-gray-700/40 rounded-lg border transition-all duration-200
        ${isSelected 
          ? 'border-blue-400/60 bg-gradient-to-br from-blue-500/10 to-blue-600/5 shadow-lg shadow-blue-500/20' 
          : 'border-gray-600/40 hover:border-gray-500/60'
        }
        ${isPlaying 
          ? 'shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
          : ''
        }
      `}
    >
      <div className="absolute top-0 left-0 right-0 h-1 flex rounded-t-lg overflow-hidden">
        {isSelected && (
          <div className="flex-1 bg-gradient-to-r from-blue-400 to-blue-500" />
        )}
        {isPlaying && (
          <div className="flex-1 bg-gradient-to-r from-green-400 to-green-500 animate-pulse" />
        )}
      </div>

      <div className="p-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-300 truncate min-w-0">
              Sprite #{sprite.id}
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            {isSelected && (
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <svg aria-hidden="true" className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <Button
              onClick={handleDelete}
              variant="danger"
              className="w-4 h-4 bg-red-500/80 hover:bg-red-500 rounded-full p-0 min-h-0 min-w-0"
              title="Delete sprite"
              aria-label="Delete sprite"
            >
              <svg aria-hidden="true" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>

        <div className="flex-1 bg-gray-800/50 rounded border border-gray-600/30 mb-3 overflow-hidden py-2">
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-xs text-gray-500">
              {sprite.spriteGrid.rows}×{sprite.spriteGrid.cols}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Button
            onClick={handleTogglePlay}
            variant={isPlaying ? "danger" : "success"}
            className="w-full h-8 space-x-2"
            aria-label={isPlaying ? "Pause sprite" : "Play sprite"}
          >
            {isPlaying ? (
              <>
                <svg aria-hidden="true" className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zM13 8a1 1 0 012 0v4a1 1 0 11-2 0V8z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium">Pause</span>
              </>
            ) : (
              <>
                <svg aria-hidden="true" className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium">Play</span>
              </>
            )}
          </Button>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400 w-8">Speed</span>
              <Select
                value={speed || 1}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                variant="filled"
                className="flex-1 text-xs px-2 py-1"
                aria-label="Animation speed"
              >
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
              </Select>
            </div>

          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400 w-8">Loop</span>
            <Button
              onClick={handleLoopToggle}
              variant={loop ? "primary" : "ghost"}
              className={`flex-1 h-6 text-xs ${
                !loop ? 'bg-gray-600/50 hover:bg-gray-600 text-gray-300 border border-gray-500/50' : ''
              }`}
              aria-label={loop ? "Disable loop" : "Enable loop"}
            >
              {loop ? 'ON' : 'OFF'}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400 w-8">Debug</span>
            <Button
              onClick={handleDebugToggle}
              variant={debug ? "primary" : "ghost"}
              className={`flex-1 h-6 text-xs ${
                !debug ? 'bg-gray-600/50 hover:bg-gray-600 text-gray-300 border border-gray-500/50' : ''
              }`}
              aria-label={debug ? "Disable debug overlay" : "Enable debug overlay"}
            >
              {debug ? 'ON' : 'OFF'}
            </Button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center">
              <span className="text-xs text-gray-400 w-12">Control</span>
              <Button
                onClick={handleControllerToggle}
                variant={hasController ? "danger" : "success"}
                className={`flex-1 h-6 text-xs ${
                  hasController ? 'bg-red-600/50 hover:bg-red-600 text-red-300 border border-red-500/50' :
                  'bg-green-600/50 hover:bg-green-600 text-green-300 border border-green-500/50'
                }`}
                aria-label={hasController ? "Remove controller" : "Create controller"}
              >
                {hasController ? 'Remove' : 'Create'}
              </Button>
            </div>
            
            {hasController && (
              <div className="flex items-center">
                <div className="flex space-x-1 flex-1">
                  <Button
                    onClick={handleControllerBindToggle}
                    variant={isControlled ? "primary" : "ghost"}
                    className={`flex-1 h-6 text-xs ${
                      isControlled ? 'bg-green-600/50 hover:bg-green-600 text-green-300 border border-green-500/50' : 
                      'bg-gray-600/50 hover:bg-gray-600 text-gray-300 border border-gray-500/50'
                    }`}
                    aria-label={isControlled ? "Unbind keyboard control" : "Bind keyboard control"}
                  >
                    {isControlled ? 'Active' : 'Bind'}
                  </Button>
                  <Button
                    onClick={handleEditController}
                    variant="primary"
                    className="flex-1 h-6 text-xs bg-blue-600/50 hover:bg-blue-600 text-blue-300 border border-blue-500/50"
                    aria-label="Edit controller"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400 w-8">FPS</span>
            <Select
              value={fps === undefined ? "default" : String(fps)}
              onChange={(e) => handleFpsChange(e.target.value)}
              variant="filled"
              className="flex-1 text-xs px-2 py-1"
              aria-label="Frames per second"
            >
              <option value="default">Default</option>
              <option value="6">6</option>
              <option value="12">12</option>
              <option value="24">24</option>
              <option value="30">30</option>
              <option value="60">60</option>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400 w-8">Onion</span>
            <Button
              onClick={handleOnionToggle}
              variant={onionSkin ? "primary" : "ghost"}
              className={`flex-1 h-6 text-xs ${
                !onionSkin ? 'bg-gray-600/50 hover:bg-gray-600 text-gray-300 border border-gray-500/50' : ''
              }`}
              aria-label={onionSkin ? "Disable onion-skinning" : "Enable onion-skinning"}
            >
              {onionSkin ? 'ON' : 'OFF'}
            </Button>
          </div>

          {frameCount > 1 && (
            <Range
              label="Frame"
              min={0}
              max={frameCount - 1}
              step={1}
              value={Math.min(scrubIndex, frameCount - 1)}
              onChange={(e) => handleScrub(parseInt(e.target.value, 10))}
              formatValue={(value) => `${value + 1}/${frameCount}`}
              variant="primary"
              fullWidth
            />
          )}

          <div className="flex items-center">
            <span className="text-xs text-gray-400 w-12">Export</span>
            <div className="flex space-x-1 flex-1">
              <Button
                onClick={handleExportSheet}
                variant="ghost"
                className="flex-1 h-6 text-xs bg-gray-600/50 hover:bg-gray-600 text-gray-300 border border-gray-500/50"
                aria-label="Export sprite sheet as PNG"
              >
                PNG
              </Button>
              <Button
                onClick={handleExportWebp}
                variant="ghost"
                className="flex-1 h-6 text-xs bg-gray-600/50 hover:bg-gray-600 text-gray-300 border border-gray-500/50"
                aria-label="Export animation as WebP"
              >
                WebP
              </Button>
              <Button
                onClick={handleExportApng}
                variant="ghost"
                className="flex-1 h-6 text-xs bg-gray-600/50 hover:bg-gray-600 text-gray-300 border border-gray-500/50"
                aria-label="Export animation as APNG"
              >
                APNG
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
