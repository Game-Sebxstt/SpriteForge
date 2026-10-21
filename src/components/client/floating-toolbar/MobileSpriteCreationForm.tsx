"use client"

import { Button } from '@/components/common';
import { useSpriteForm } from '@/hooks/useSpriteForm';
import { X } from 'lucide-react';
import SpriteFormBody from './SpriteFormBody';
import type { SpriteProps } from '@/lib/types/Shape';

interface MobileSpriteCreationFormProps {
  onCreateSprite: (props: SpriteProps) => void;
  onClose: () => void;
}

export default function MobileSpriteCreationForm({ onCreateSprite, onClose }: MobileSpriteCreationFormProps) {
  const { spriteForm, setSpriteForm, handleFileUpload, handleCreateSprite } = useSpriteForm({ onCreateSprite, onClose });

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[calc(100%-2rem)] max-w-md p-6 relative">
        <Button onClick={onClose} size="icon" variant="ghost" className="absolute top-3 right-3" aria-label="Close">
          <X className="w-6 h-6" />
        </Button>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Sprite</h3>
        <div className="space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
          <SpriteFormBody
            spriteForm={spriteForm}
            setSpriteForm={setSpriteForm}
            handleFileUpload={handleFileUpload}
            labelClassName="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            uploadIconClassName="w-4 h-4 mr-2"
          />

          <Button
            onClick={handleCreateSprite}
            variant="primary"
            fullWidth
            size="lg"
          >
            Create Sprite
          </Button>
        </div>
      </div>
    </div>
  );
}
