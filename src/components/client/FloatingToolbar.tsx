"use client"

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/common";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import SpriteCreationForm from "./floating-toolbar/SpriteCreationForm";
import MobileSpriteCreationForm from "./floating-toolbar/MobileSpriteCreationForm";
import type { SpriteProps } from "@/lib/types/Shape";

interface FloatingToolbarProps {
  onCreateSprite: (props: SpriteProps) => void;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportScene: () => void;
  onImportScene: (file: File) => void;
}

type DropdownType = 'sprite' | 'share' | null;

export default function FloatingToolbar({
  onCreateSprite,
  isPlaying,
  onPlay,
  onStop,
  onUndo,
  onRedo,
  onExportScene,
  onImportScene,
}: FloatingToolbarProps) {
  const [activeDropdown, setActiveDropdown] = useState<DropdownType>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery('(max-width: 640px)');

  const handleImportChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImportScene(file);
    // Reset so selecting the same file again re-fires onChange.
    event.target.value = "";
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (!isMobile) {
          setActiveDropdown(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile]);

  const handleCloseForm = () => {
    setActiveDropdown(null);
  };

  return (
    <>
      <div className="fixed top-6 left-6 z-40" ref={dropdownRef}>
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-xl p-3">
          <div className="flex items-center space-x-1">
            <Button
              onClick={isPlaying ? onStop : onPlay}
              variant={isPlaying ? "danger" : "success"}
              size="icon"
              className="group relative hover:scale-105 active:scale-95"
              title={isPlaying ? "Stop Render" : "Start Render"}
              aria-label={isPlaying ? "Stop Render" : "Start Render"}
            >
              {isPlaying ? (
                <svg aria-hidden="true" className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v6a1 1 0 11-2 0V7zM12 7a1 1 0 012 0v6a1 1 0 11-2 0V7z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg aria-hidden="true" className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </Button>

            <div className="relative">
              <Button
                onClick={() => setActiveDropdown(activeDropdown === 'sprite' ? null : 'sprite')}
                variant="primary"
                size="icon"
                className={`group relative hover:scale-105 active:scale-95 ${
                  activeDropdown === 'sprite' ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : ''
                }`}
                title="Create Sprite"
                aria-label="Create Sprite"
              >
                <svg aria-hidden="true" className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </Button>
              {activeDropdown === 'sprite' && !isMobile && (
                  <SpriteCreationForm onCreateSprite={onCreateSprite} onClose={handleCloseForm} />
              )}
            </div>

            <Button
              onClick={onUndo}
              variant="ghost"
              size="icon"
              className="group relative hover:scale-105 active:scale-95"
              title="Undo"
              aria-label="Undo"
            >
              <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v1m-16-6l4-4m-4 4l4 4" />
              </svg>
            </Button>

            <Button
              onClick={onRedo}
              variant="ghost"
              size="icon"
              className="group relative hover:scale-105 active:scale-95"
              title="Redo"
              aria-label="Redo"
            >
              <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v1m16-6l-4-4m4 4l-4 4" />
              </svg>
            </Button>

            <Button
              onClick={onExportScene}
              variant="ghost"
              size="icon"
              className="group relative hover:scale-105 active:scale-95"
              title="Export Scene"
              aria-label="Export Scene"
            >
              <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </Button>

            <Button
              onClick={() => importInputRef.current?.click()}
              variant="ghost"
              size="icon"
              className="group relative hover:scale-105 active:scale-95"
              title="Import Scene"
              aria-label="Import Scene"
            >
              <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportChange}
              aria-label="Import scene file"
            />
          </div>
        </div>
      </div>
      {activeDropdown === 'sprite' && isMobile && (
        <MobileSpriteCreationForm onCreateSprite={onCreateSprite} onClose={handleCloseForm} />
      )}
    </>
  );
}