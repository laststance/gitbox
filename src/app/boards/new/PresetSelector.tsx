'use client'

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { memo } from 'react'

import {
  BOARD_PRESETS,
  SELECTABLE_PRESET_IDS,
  type SelectablePresetId,
} from '@/lib/constants/board-presets'
import { cn } from '@/lib/utils'

interface PresetSelectorProps {
  value: SelectablePresetId
  onChange: (value: SelectablePresetId) => void
  disabled?: boolean
  /** Id of the text that names the group, read before its cards. */
  'aria-labelledby'?: string
  /** Id of the text that says what the group is for. */
  'aria-describedby'?: string
}

/**
 * Radio card grid for selecting a board preset.
 * Shows one card per entry of {@link SELECTABLE_PRESET_IDS} (6 today) with
 * color-coded column previews. Presets that only the server accepts
 * ({@link PRESET_IDS} holds them too) get no card here.
 *
 * @param value - Currently selected preset ID
 * @param onChange - Callback when preset selection changes
 * @param disabled - Disable all interactions (e.g., during form submission)
 * @param aria-labelledby - Id of the label of the group. Without it a screen
 *   reader reads six radio cards and never says what they choose.
 * @param aria-describedby - Id of the help text of the group.
 * @example
 * <Label id="preset-label">Column Preset</Label>
 * <PresetSelector value="web-app" onChange={setPresetId} aria-labelledby="preset-label" />
 */
export const PresetSelector = memo(function PresetSelector({
  value,
  onChange,
  disabled,
  'aria-labelledby': labelId,
  'aria-describedby': descriptionId,
}: PresetSelectorProps) {
  return (
    <RadioGroupPrimitive.Root
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      value={value}
      onValueChange={(selectedValue) => {
        // Radix hands back a plain string; take the matching id from the list
        const selectedPresetId = SELECTABLE_PRESET_IDS.find(
          (presetId) => presetId === selectedValue,
        )
        if (selectedPresetId) onChange(selectedPresetId)
      }}
      disabled={disabled}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {SELECTABLE_PRESET_IDS.map((presetId) => {
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
