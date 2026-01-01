'use client'

/**
 * Create Link Type Dialog
 *
 * A dialog for creating custom link type presets.
 * The created preset is saved to user_link_presets table
 * and becomes available in the LinkTypeCombobox.
 *
 * @see lib/actions/user-presets.ts for the server action
 */

import { useState, useCallback, useTransition, memo } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUserPreset, type UserPreset } from '@/lib/actions/user-presets'

/** Common icon options for link types */
const ICON_OPTIONS = [
  { value: 'Link', label: 'Link' },
  { value: 'Globe', label: 'Globe' },
  { value: 'Server', label: 'Server' },
  { value: 'Database', label: 'Database' },
  { value: 'Cloud', label: 'Cloud' },
  { value: 'Code', label: 'Code' },
  { value: 'FileText', label: 'Document' },
  { value: 'Folder', label: 'Folder' },
  { value: 'Settings', label: 'Settings' },
  { value: 'Wrench', label: 'Tool' },
  { value: 'Activity', label: 'Activity' },
  { value: 'BarChart2', label: 'Analytics' },
  { value: 'Bell', label: 'Notifications' },
  { value: 'Box', label: 'Package' },
  { value: 'Star', label: 'Star' },
  { value: 'Heart', label: 'Heart' },
  { value: 'Zap', label: 'Lightning' },
  { value: 'Shield', label: 'Shield' },
  { value: 'Lock', label: 'Lock' },
  { value: 'Key', label: 'Key' },
] as const

interface CreateLinkTypeDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void
  /** Callback when a new preset is created */
  onCreated?: (preset: UserPreset) => void
}

/**
 * Create Link Type Dialog
 *
 * @example
 * const [showDialog, setShowDialog] = useState(false)
 * const [userPresets, setUserPresets] = useState<UserPreset[]>([])
 *
 * <CreateLinkTypeDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   onCreated={(preset) => setUserPresets([...userPresets, preset])}
 * />
 */
export const CreateLinkTypeDialog = memo(function CreateLinkTypeDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateLinkTypeDialogProps) {
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState('Link')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const resetForm = useCallback(() => {
    setLabel('')
    setIcon('Link')
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onOpenChange(false)
  }, [resetForm, onOpenChange])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      setError('Label is required')
      return
    }

    if (trimmedLabel.length > 50) {
      setError('Label must be 50 characters or less')
      return
    }

    startTransition(async () => {
      try {
        const preset = await createUserPreset(trimmedLabel, icon)
        onCreated?.(preset)
        handleClose()
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to create custom type')
        }
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        data-testid="create-link-type-dialog"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Custom Link Type</DialogTitle>
            <DialogDescription>
              Add a new link type for your projects. This will be available
              across all your boards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Label Input */}
            <div className="space-y-2">
              <Label htmlFor="link-type-label">Name</Label>
              <Input
                id="link-type-label"
                placeholder="e.g., My Service"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={50}
                autoFocus
                data-testid="link-type-label-input"
                aria-describedby={error ? 'link-type-error' : undefined}
                aria-invalid={!!error}
              />
              <p className="text-sm text-muted-foreground">
                {label.length}/50 characters
              </p>
            </div>

            {/* Icon Select */}
            <div className="space-y-2">
              <Label htmlFor="link-type-icon">Icon</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger
                  id="link-type-icon"
                  data-testid="link-type-icon-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Error Message */}
            {error && (
              <p
                id="link-type-error"
                className="text-sm text-destructive"
                role="alert"
                data-testid="link-type-error"
              >
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
              data-testid="cancel-create-link-type"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !label.trim()}
              data-testid="submit-create-link-type"
            >
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
})
