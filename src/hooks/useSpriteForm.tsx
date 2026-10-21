import { useState } from 'react';
import { Vector } from '@/lib/common/Vector';
import { notify } from '@/lib/notify';
import type { SpriteProps } from '@/lib/types/Shape';

/** Max upload size (pre-base64) kept under the ~5 MB localStorage budget. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

interface UseSpriteFormProps {
  onCreateSprite: (props: SpriteProps) => void;
  onClose: () => void;
}

export function useSpriteForm({ onCreateSprite, onClose }: UseSpriteFormProps) {
  const [spriteForm, setSpriteForm] = useState({
    src: '',
    rows: 1,
    cols: 1,
    ignoreFrames: '',
    pattern: '',
    x: 100,
    y: 100
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify('Only image files can be uploaded.', 'error');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      notify('Image is too large (max 4 MB).', 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSpriteForm({ ...spriteForm, src: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleCreateSprite = () => {
    if (!spriteForm.src.trim()) {
      alert('Please provide an image source');
      return;
    }

    const ignoreFrames: number[] = [];
    const ignoreFramesSplited = spriteForm.ignoreFrames.trim().split(",");
    ignoreFramesSplited.forEach((frame) => {
      const frameFormatted = Number(frame);
      if (!isNaN(frameFormatted)) {
        ignoreFrames.push(frameFormatted);
      }

      if (frame.includes(":")) {
        const parts = frame.split(":").map(Number);
        const start = parts[0];
        const end = parts[1];
        if (start !== undefined && end !== undefined && !isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            ignoreFrames.push(i);
          }
        }
      }
    });

    let pattern: string[] | undefined = undefined;
    if (spriteForm.pattern.trim()) {
      pattern = spriteForm.pattern.split(',').map(p => p.trim()).filter(p => p);
    }

    onCreateSprite({
      position: new Vector(spriteForm.x, spriteForm.y),
      src: spriteForm.src,
      spriteGrid: { rows: spriteForm.rows, cols: spriteForm.cols },
      ignoreFrames,
      pattern,
      dragging: true
    });
    onClose();
  };

  return {
    spriteForm,
    setSpriteForm,
    handleFileUpload,
    handleCreateSprite,
  };
}
