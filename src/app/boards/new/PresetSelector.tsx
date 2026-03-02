'use client'

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { memo } from 'react'

import {
  BOARD_PRESETS,
  PRESET_IDS,
  type PresetId,
} from '@/lib/constants/board-presets'
import { cn } from '@/lib/utils'

interface PresetSelectorProps {
  value: PresetId
  onChange: (value: PresetId) => void
  disabled?: boolean
}

/**
 * Radio card grid for selecting a board preset.
 * Shows 6 preset cards with color-coded column previews.
 *
 * @param value - Currently selected preset ID
 * @param onChange - Callback when preset selection changes
 * @param disabled - Disable all interactions (e.g., during form submission)
 * @example
 * <PresetSelector value="web-app" onChange={setPresetId} />
 */
export const PresetSelector = memo(function PresetSelector({
  value,
  onChange,
  disabled,
}: PresetSelectorProps) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(v) => onChange(v as PresetId)}
      disabled={disabled}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {PRESET_IDS.map((presetId) => {
        const preset = BOARD_PRESETS[presetId]
        const isSelected = value === presetId
        return (
          <RadioGroupPrimitive.Item
            key={presetId}
            value={presetId}
            className={cn(
              'bg-card text-card-foreground rounded-lg border-2 p-4 text-left transition-colors',
              'hover:border-primary/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              isSelected ? 'border-primary bg-primary/5' : 'border-border',
              disabled && 'pointer-events-none opacity-50',
            )}
          >
            <div className="text-sm font-medium">{preset.label}</div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {preset.description}
            </div>
            <div className="mt-2 space-y-1">
              {preset.columns.map((col) => (
                <div key={col.name} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="text-muted-foreground text-xs">
                    {col.name}
                  </span>
                </div>
              ))}
            </div>
          </RadioGroupPrimitive.Item>
        )
      })}
    </RadioGroupPrimitive.Root>
  )
})
