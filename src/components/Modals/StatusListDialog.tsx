'use client'

import React, { useState, memo } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { StatusListDomain } from '@/lib/models/domain'

// Preset colors (WCAG AA compliant)
const PRESET_COLORS = [
  { name: 'Brown', value: '#8B7355' },
  { name: 'Olive', value: '#6B8E23' },
  { name: 'Orange', value: '#CD853F' },
  { name: 'Blue', value: '#4682B4' },
  { name: 'Green', value: '#556B2F' },
  { name: 'Purple', value: '#8B668B' },
  { name: 'Red', value: '#B22222' },
  { name: 'Teal', value: '#20B2AA' },
  { name: 'Pink', value: '#DB7093' },
  { name: 'Gray', value: '#6B7280' },
]

const DEFAULT_COLOR = '#6B7280'

interface StatusListFormProps {
  mode: 'create' | 'edit'
  initialName: string
  initialColor: string
  onSave: (data: { name: string; color: string }) => Promise<void>
  onClose: () => void
}

/**
 * Status List Form Component (Internal)
 *
 * Form content for creating/editing status columns.
 * State is initialized from props - no useEffect needed.
 * Parent uses `key` prop to reset state when switching modes/items.
 */
const StatusListForm = memo(function StatusListForm({
  mode,
  initialName,
  initialColor,
  onSave,
  onClose,
}: StatusListFormProps) {
  // State initialized directly from props
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Form submission handler
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    try {
      setIsSaving(true)
      await onSave({
        name: name.trim(),
        color,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {mode === 'create' ? 'Add Status Column' : 'Edit Status Column'}
        </DialogTitle>
        <DialogDescription>
          {mode === 'create'
            ? 'Create a new status column for your Kanban board.'
            : 'Edit the settings for this status column.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="status-name">Name</Label>
          <Input
            id="status-name"
            name="status-column-title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., In Progress, Review"
            maxLength={50}
            autoFocus
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
          />
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setColor(preset.value)}
                data-color={preset.value}
                className={`
                  w-8 h-8 rounded-full border-2 transition-all
                  ${color === preset.value ? 'border-foreground scale-110' : 'border-transparent'}
                `}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
                aria-label={preset.name}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Label
              htmlFor="custom-color"
              className="text-xs text-muted-foreground"
            >
              Custom:
            </Label>
            <Input
              id="custom-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-12 h-8 p-0 border-0 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground font-mono">
              {color}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving
              ? 'Saving...'
              : mode === 'create'
                ? 'Add Column'
                : 'Save Changes'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
})

interface StatusListDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { name: string; color: string }) => Promise<void>
  statusList?: StatusListDomain | null
  mode: 'create' | 'edit'
}

/**
 * Status List Dialog Component
 *
 * A dialog for creating and editing status columns in the Kanban board.
 * - Column name input with validation
 * - Color selection (preset options and custom color picker)
 * - Supports both create and edit modes
 *
 * Uses the "key pattern" for state reset:
 * When mode or statusList changes, the form component is re-mounted
 * with fresh state, eliminating the need for useEffect sync.
 */
export const StatusListDialog = memo(function StatusListDialog({
  isOpen,
  onClose,
  onSave,
  statusList,
  mode,
}: StatusListDialogProps) {
  // Generate unique key for form reset
  // - In edit mode: use statusList.id (re-mount when editing different item)
  // - In create mode: use 'create' (same key = same form state persists)
  const formKey = mode === 'edit' && statusList ? statusList.id : 'create'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen && (
        <StatusListForm
          key={formKey}
          mode={mode}
          initialName={statusList?.title ?? ''}
          initialColor={statusList?.color ?? DEFAULT_COLOR}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
})
