"use client"

import { useRef } from 'react';
import { Button, Input } from '@/components/common';

/** The subset of `useSpriteForm` state/handlers the shared body needs. */
export interface SpriteFormState {
  src: string;
  rows: number;
  cols: number;
  ignoreFrames: string;
  pattern: string;
  x: number;
  y: number;
}

interface SpriteFormBodyProps {
  spriteForm: SpriteFormState;
  setSpriteForm: React.Dispatch<React.SetStateAction<SpriteFormState>>;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Tailwind classes for the field labels (differs between desktop/mobile). */
  labelClassName: string;
  /** Extra classes applied to the upload button's inline SVG (mobile adds mr-2). */
  uploadIconClassName?: string;
}

/**
 * Shared field body for the desktop (`SpriteCreationForm`) and mobile
 * (`MobileSpriteCreationForm`) sprite creation UIs. Markup/behavior is
 * identical to the previous per-component copies; only the label sizing and
 * the upload-icon spacing vary (passed in by the caller) so both surfaces
 * render exactly as before (DUP-1).
 */
export default function SpriteFormBody({
  spriteForm,
  setSpriteForm,
  handleFileUpload,
  labelClassName,
  uploadIconClassName = 'w-4 h-4',
}: SpriteFormBodyProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div>
        <label className={labelClassName}>Image Source</label>
        <div className="space-y-2">
          <Input
            type="text"
            value={spriteForm.src}
            onChange={(e) => setSpriteForm({ ...spriteForm, src: e.target.value })}
            placeholder="Enter image URL or path"
            variant="default"
            fullWidth
          />
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">or</span>
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50"
            >
              <svg aria-hidden="true" className={uploadIconClassName} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>Upload Image</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          {spriteForm.src && spriteForm.src.startsWith('data:') && (
            <div className="flex items-center space-x-2 text-xs text-green-600 dark:text-green-400">
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Image uploaded successfully</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClassName}>Grid Rows</label>
          <Input
            type="number"
            min={1}
            value={spriteForm.rows}
            onChange={(e) => setSpriteForm({ ...spriteForm, rows: parseInt(e.target.value) || 1 })}
            variant="default"
            fullWidth
          />
        </div>
        <div>
          <label className={labelClassName}>Grid Cols</label>
          <Input
            type="number"
            min={1}
            value={spriteForm.cols}
            onChange={(e) => setSpriteForm({ ...spriteForm, cols: parseInt(e.target.value) || 1 })}
            variant="default"
            fullWidth
          />
        </div>
      </div>

      <div>
        <label className={labelClassName}>Pattern</label>
        <Input
          type="text"
          placeholder="Example: 1, 5, 6:12, 22:-1, 2x8, 1(5)"
          value={spriteForm.pattern}
          onChange={(e) => setSpriteForm({ ...spriteForm, pattern: e.target.value })}
          variant="default"
          fullWidth
          description="Define custom frame sequence. Leave empty to use start/end frames."
        />
      </div>

      <div>
        <label className={labelClassName}>Ignore Frames</label>
        <Input
          type="text"
          placeholder="Example: 0, 1, 2"
          value={spriteForm.ignoreFrames}
          onChange={(e) => setSpriteForm({ ...spriteForm, ignoreFrames: e.target.value })}
          variant="default"
          fullWidth
        />
      </div>
    </>
  );
}
