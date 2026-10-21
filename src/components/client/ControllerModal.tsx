"use client"

import { useState, useEffect } from "react";
import { Button, Input, Select, Range } from "@/components/common";
import { X } from "lucide-react";
import { KEY_MAPPING } from "@/config/key-mapping";
import { Vector } from "@/lib/common/Vector";
import { useSceneStore } from "@/lib/store/useSceneStore";
import type { ControllerProps } from "@/lib/types/Controller";

export default function ControllerModal() {
  const setIsControllerModalOpen = useSceneStore((s) => s.setIsControllerModalOpen);
  const setSelectedSpriteForController = useSceneStore((s) => s.setSelectedSpriteForController);
  const selectedSpriteForController = useSceneStore((s) => s.selectedSpriteForController);
  const isControllerModalOpen = useSceneStore((s) => s.isControllerModalOpen);
  const patchView = useSceneStore((s) => s.patchView);
  const [config, setConfig] = useState<ControllerProps>({
      keywords: {
        up: "w",
        down: "s",
        left: "a",
        right: "d",
        jump: " "
      },
      status: {
        up: ["0"],
        down: ["0"],
        left: ["0"],
        right: ["0"],
        jump: ["0"],
        fall: ["0"],
        idle: ["0"]
      },
      speed: 5,
      jumpForce: 15
    }
  );

  const isEditing = selectedSpriteForController?.controller !== null && selectedSpriteForController?.controller !== undefined;

  useEffect(() => {
    if (isControllerModalOpen && selectedSpriteForController?.controller) {
      const existingConfig = selectedSpriteForController.controller.config;
      setConfig(existingConfig);
    } else if (isControllerModalOpen && !selectedSpriteForController?.controller) {
      setConfig({
        keywords: {
          up: "w",
          down: "s",
          left: "a",
          right: "d",
          jump: " "
        },
        status: {
          up: ["0"],
          down: ["0"],
          left: ["0"],
          right: ["0"],
          jump: ["0"],
          fall: ["0"],
          idle: ["0"]
        },
        speed: 5,
        jumpForce: 15
      });
    }
  }, [isControllerModalOpen, selectedSpriteForController]);

  const handleConfigChange = (
    action: keyof ControllerProps['status'],
    field: 'key' | 'pattern',
    value: string
  ) => {
    setConfig(prev => {
      if (field === 'key' && action !== 'idle' && action !== 'fall') {
        return {
          ...prev,
          keywords: {
            ...prev.keywords,
            [action as keyof ControllerProps['keywords']]: value,
          },
        };
      }
      if (field === 'pattern') {
        return {
          ...prev,
          status: {
            ...prev.status,
            [action]: [value],
          },
        };
      }
      return prev;
    });
  };

  const handleSpeedChange = (value: number) => {
    setConfig(prev => ({
      ...prev,
      speed: value
    }));
  };

  const handleJumpForceChange = (value: number) => {
    setConfig(prev => ({
      ...prev,
      jumpForce: value
    }));
  };

  const handleCancel = () => {
    setIsControllerModalOpen(false);
    setSelectedSpriteForController(null);
  };

  const handleSave = () => {
    if (isEditing && selectedSpriteForController?.controller) {
      selectedSpriteForController.controller.keywords = config.keywords;
      selectedSpriteForController.controller.speed = config.speed || 5;
      selectedSpriteForController.controller.jumpForce = new Vector(0, config.jumpForce || 15);
    } else if (selectedSpriteForController) {
      selectedSpriteForController.manager.controller(config);
      patchView(selectedSpriteForController.id, { hasController: true });
    }
    handleCancel();
  };

  const REVERSE_KEY_MAPPING = Object.fromEntries(
    Object.entries(KEY_MAPPING).map(([label, value]) => [value, label])
  );

  if (!isControllerModalOpen) return null;

  return (
    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[calc(100%-2rem)] max-w-md p-6 relative">
        <Button onClick={handleCancel} size="icon" variant="ghost" className="absolute top-3 right-3">
          <X className="w-6 h-6" />
        </Button>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {isEditing ? 'Edit Controller' : 'Create Controller'}
        </h3>
        <div className="space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Actions</label>
            <div className="space-y-3">
              {(['up', 'down', 'left', 'right', 'jump', 'fall', 'idle'] as const).map((action) => {
                const usedKeys = Object.values(config.keywords);
                return (
                  <div key={action} className="grid grid-cols-[80px_1fr_1fr] gap-3 items-center">
                    <span id={`controller-action-${action}`} className="text-sm font-medium text-gray-600 dark:text-gray-400 capitalize">{action}</span>
                    {action !== 'idle' && action !== 'fall' ? (
                      <Select
                        value={REVERSE_KEY_MAPPING[config.keywords[action]]}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const label = e.target.value;
                          const newKey = KEY_MAPPING[label as keyof typeof KEY_MAPPING];
                          handleConfigChange(action, 'key', newKey);
                        }}
                        variant="filled"
                        aria-labelledby={`controller-action-${action}`}
                        aria-label={`${action} key`}
                      >
                        {Object.keys(KEY_MAPPING).map((label) => {
                          const value = KEY_MAPPING[label as keyof typeof KEY_MAPPING];
                          const isUsedByOtherAction = usedKeys.includes(value) && config.keywords[action] !== value;
                          return (
                            <option key={label} value={label} disabled={isUsedByOtherAction}>
                              {label}
                            </option>
                          );
                        })}
                      </Select>
                    ) : <div />}
                    <Input
                      type="text"
                      value={config.status[action]?.[0] || ''}
                      onChange={(e) => handleConfigChange(action, 'pattern', e.target.value)}
                      placeholder="Pattern (e.g., 4:7)"
                      variant="filled"
                      fullWidth
                      aria-label={`${action} pattern`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <Range
            label="Movement Speed"
            min={1}
            max={10}
            step={1}
            value={config.speed}
            onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
            formatValue={(value) => `${value}x`}
            variant="primary"
            fullWidth
          />

          <Range
            label="Jump Force"
            min={5}
            max={50}
            step={1}
            value={config.jumpForce}
            onChange={(e) => handleJumpForceChange(parseInt(e.target.value))}
            variant="success"
            fullWidth
          />

          <Button
            onClick={handleSave}
            variant="primary"
            fullWidth
            size="lg"
          >
            {isEditing ? 'Update Controller' : 'Create Controller'}
          </Button>
        </div>
      </div>
    </div>
  );
}
