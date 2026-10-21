"use client"

import { useState, useRef, useEffect } from "react";
import { Sprite } from "@/lib/instances/_shapes/Sprite";
import SpriteSlot from "@/components/client/panel/SpriteSlot";
import { useSceneStore } from "@/lib/store/useSceneStore";

interface BottomPanelProps {
  onDeleteSprite: (sprite: Sprite) => void;
}

export default function BottomPanel({
  onDeleteSprite
}: BottomPanelProps) {
  const sprites = useSceneStore((s) => s.sprites);
  const views = useSceneStore((s) => s.views);

  const selectedCount = sprites.reduce((n, s) => n + (views[s.id]?.selected ? 1 : 0), 0);
  const playingCount = sprites.reduce((n, s) => n + (views[s.id]?.isPlaying ? 1 : 0), 0);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [panelHeight, setPanelHeight] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const minHeight = 120;
  const maxHeight = 400;

  useEffect(() => {
    const handleMove = (clientY: number) => {
      if (!isResizing) return;
      
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const newHeight = window.innerHeight - clientY;
      const clampedHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);
      setPanelHeight(clampedHeight);
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) {
        handleMove(touch.clientY);
      }
    };

    const handleEnd = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('touchcancel', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isResizing]);

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  const handleTouchStart = () => {
    setIsResizing(true);
  };

  return (
    <div 
      ref={panelRef}
      className={`
        fixed bottom-0 left-0 right-0 z-40
        bg-gray-800/95 backdrop-blur-lg border-t border-gray-700
        shadow-2xl transition-transform duration-300 ease-in-out
        ${isCollapsed ? 'translate-y-full' : 'translate-y-0'}
      `}
      style={{ height: isCollapsed ? '40px' : `${panelHeight}px` }}
    >
      <div
        ref={resizeRef}
        onMouseDown={handleResizeStart}
        onTouchStart={handleTouchStart}
        className={`
          absolute -top-2 left-0 right-0 h-5 cursor-ns-resize touch-none
          transition-colors duration-200
          ${isResizing ? '' : ''}
        `}
      >
        <div className={`
          absolute top-2 left-0 right-0 h-1
          bg-gray-600 hover:bg-gray-500 transition-colors duration-200
          ${isResizing ? 'bg-blue-500' : ''}
        `} />
      </div>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`
          absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full
          w-20 h-10 bg-gradient-to-t from-blue-600/90 to-blue-500/90 backdrop-blur-lg
          border border-b-0 border-blue-400/50 rounded-t-xl
          flex items-center justify-center space-x-2
          hover:from-blue-500/90 hover:to-blue-400/90 hover:border-blue-300/60
          transition-all duration-300 shadow-xl z-10
          ${isCollapsed ? 'animate-pulse shadow-blue-500/30' : 'shadow-blue-600/20'}
        `}
      >
        <svg 
          className={`w-5 h-5 text-white transition-transform duration-300 ${
            isCollapsed ? 'rotate-180' : ''
          }`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2.5} 
            d="M5 15l7-7 7 7" 
          />
        </svg>
        {isCollapsed && (
          <div className="flex space-x-0.5">
            <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}
      </button>

      <div className="h-full flex flex-col pt-2 pb-4 px-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-200">
              Sprites ({sprites.length})
              {selectedCount > 0 && (
                <span className="ml-2 text-blue-400">• {selectedCount} selected</span>
              )}
              {playingCount > 0 && (
                <span className="ml-2 text-green-400">• {playingCount} playing</span>
              )}
            </h3>
          </div>
          
          <div className="text-xs text-gray-400">
            Height: {panelHeight}px
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {sprites.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-400 text-sm">No sprites loaded</p>
                <p className="text-gray-500 text-xs mt-1">Create sprites using the toolbar above</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="grid gap-3 pb-2 auto-rows-max grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {sprites.map((sprite) => {
                  const isSelected = views[sprite.id]?.selected ?? false;
                  
                  return (
                    <SpriteSlot
                      key={sprite.id}
                      sprite={sprite}
                      isSelected={isSelected}
                      onDelete={onDeleteSprite}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
