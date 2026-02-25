/**
 * EditableUrlItem Component
 *
 * Inline editable URL item with pen icon trigger, following Comment-style UX.
 *
 * Features:
 * - Display mode: Clickable URL link with tooltip
 * - Edit mode: Input field with save/delete buttons
 * - Pen icon triggers edit (URL click opens link in new tab)
 * - Single-edit coordination via forceExitEdit prop
 * - Delete with undo toast (8s duration)
 * - Save success animation
 * - Protocol whitelist (http/https only)
 * - WCAG 2.1 AA compliant (44px touch targets, aria-live)
 *
 * @see Spec: spec_project_info_url_list (Serena memory)
 */

'use client'

import { Check, Loader2, Pencil, X } from 'lucide-react'
import { memo } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  LinkTypeCombobox,
  type UserPresetOption,
} from '@/components/ui/link-type-combobox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useEditableUrl } from '@/hooks/ui/useEditableUrl'
import { cn } from '@/lib/utils'

// ============================================
// Types
// ============================================

export interface ProjectLink {
  type: string
  url: string
}

export interface EditableUrlItemProps {
  /** The link data */
  link: ProjectLink
  /** Index for unique IDs and test selectors */
  index: number
  /** Callback when URL changes */
  onUrlChange: (url: string) => void
  /** Callback when type changes */
  onTypeChange: (type: string) => void
  /** Callback when delete is clicked */
  onDelete: () => void
  /** Callback for undo delete (enables undo toast) */
  onUndoDelete?: () => void
  /** User-defined presets for LinkTypeCombobox */
  userPresets: UserPresetOption[]
  /** Callback when "Add Custom" is clicked in combobox */
  onAddCustomClick: () => void
  /** Disable all interactions */
  disabled?: boolean
  /** Auto-enter edit mode (for newly added items) */
  autoEdit?: boolean
  /** Callback when edit mode starts (for single-edit coordination) */
  onEditStart?: () => void
  /** Force exit edit mode (when another item starts editing) */
  forceExitEdit?: boolean
}

// ============================================
// Component
// ============================================

export const EditableUrlItem = memo(function EditableUrlItem({
  link,
  index,
  onUrlChange,
  onTypeChange,
  onDelete,
  onUndoDelete,
  userPresets,
  onAddCustomClick,
  disabled = false,
  autoEdit = false,
  onEditStart,
  forceExitEdit = false,
}: EditableUrlItemProps) {
  const {
    isEditing,
    editValue,
    error,
    isSaving,
    showSaveSuccess,
    announcement,
    inputRef,
    penButtonRef,
    handleInputChange,
    handleSave,
    handleEditStart,
    handleKeyDown,
    handleBlur,
    handleSavePointerDown,
    handleDelete,
  } = useEditableUrl({
    link,
    onUrlChange,
    onDelete,
    onUndoDelete,
    autoEdit,
    onEditStart,
    forceExitEdit,
  })

  return (
    <div className="space-y-1">
      {/* Single consolidated live region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {isEditing ? (
        // EDIT MODE
        <div className="flex items-center gap-2">
          <LinkTypeCombobox
            value={link.type}
            onValueChange={onTypeChange}
            userPresets={userPresets}
            onAddCustomClick={onAddCustomClick}
            disabled={disabled || isSaving}
          />

          <Label htmlFor={`url-input-${index}`} className="sr-only">
            {link.type || 'Link'} URL
          </Label>

          <Input
            ref={inputRef}
            id={`url-input-${index}`}
            type="url"
            value={editValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="https://example.com"
            className={cn('min-w-0 flex-1', error && 'border-destructive')}
            disabled={disabled || isSaving}
            data-testid={`url-input-${index}`}
            aria-invalid={!!error}
            aria-describedby={error ? `url-error-${index}` : undefined}
          />

          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            onClick={handleSave}
            onPointerDown={handleSavePointerDown}
            disabled={!!error || isSaving}
            data-testid={`url-save-${index}`}
            data-role="url-save-button"
            aria-label="Save URL"
            aria-busy={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            onClick={handleDelete}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={disabled || isSaving}
            data-testid={`url-delete-${index}`}
            aria-label={`Delete ${link.type || 'link'}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        // DISPLAY MODE
        <div className="flex items-center gap-2">
          <LinkTypeCombobox
            value={link.type}
            onValueChange={onTypeChange}
            userPresets={userPresets}
            onAddCustomClick={onAddCustomClick}
            disabled={disabled}
          />

          {link.url ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'text-primary min-w-0 flex-1 truncate text-base hover:underline',
                      'max-w-75 sm:max-w-100 lg:max-w-none',
                      showSaveSuccess && 'text-success animate-pulse',
                    )}
                    data-testid={`url-link-${index}`}
                  >
                    {link.url}
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-lg">
                  <p className="text-xs break-all">{link.url}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <p className="text-muted-foreground flex-1 text-sm italic">
              No URL set
            </p>
          )}

          <Button
            ref={penButtonRef}
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            onClick={handleEditStart}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={disabled}
            data-testid={`url-edit-${index}`}
            aria-label={`Edit ${link.type || 'link'} URL`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            onClick={handleDelete}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={disabled}
            data-testid={`url-delete-${index}`}
            aria-label={`Delete ${link.type || 'link'}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {error && (
        <p
          id={`url-error-${index}`}
          className="text-destructive text-sm"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
})

EditableUrlItem.displayName = 'EditableUrlItem'
