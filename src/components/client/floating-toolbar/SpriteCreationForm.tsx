"use client"

import { Button } from '@/components/common';
import { useSpriteForm } from '@/hooks/useSpriteForm';
import SpriteFormBody from './SpriteFormBody';
import type { SpriteProps } from '@/lib/types/Shape';

interface SpriteCreationFormProps {
  onCreateSprite: (props: SpriteProps) => void;
  onClose: () => void;
}

export default function SpriteCreationForm({ onCreateSprite, onClose }: SpriteCreationFormProps) {
  const { spriteForm, setSpriteForm, handleFileUpload, handleCreateSprite } = useSpriteForm({ onCreateSprite, onClose });

  return (
    <div className="absolute top-full left-0 mt-2 w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-xl p-4 z-50">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Create Sprite</h3>
      <div className="space-y-3">
        <SpriteFormBody
          spriteForm={spriteForm}
          setSpriteForm={setSpriteForm}
          handleFileUpload={handleFileUpload}
          labelClassName="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
        />

        <Button
          onClick={handleCreateSprite}
          variant="primary"
          fullWidth
        >
          Create Sprite
        </Button>
      </div>
    </div>
  );
}
