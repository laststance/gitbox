'use client'

import { Check, Palette, Pencil, Trash2 } from 'lucide-react'
import { memo } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CommentColor } from '@/lib/supabase/types'

/**
 * Color options with display names and visual indicators
 * The dotClass matches the actual applied colors (bg + border at 20%/30% opacity)
 * to provide accurate visual preview in the color picker
 */
const COLOR_OPTIONS: {
  value: CommentColor
  label: string
  dotClass: string
}[] = [
  {
    value: 'neutral',
    label: 'Neutral',
    dotClass: 'bg-muted/50 border border-muted-foreground/70',
  },
  {
    value: 'primary',
    label: 'Primary',
    dotClass: 'bg-primary/50 border border-primary/70',
  },
  {
    value: 'blue',
    label: 'Blue',
    dotClass: 'bg-blue-500/50 border border-blue-500/70',
  },
  {
    value: 'green',
    label: 'Green',
    dotClass: 'bg-green-500/50 border border-green-500/70',
  },
  {
    value: 'amber',
    label: 'Amber',
    dotClass: 'bg-amber-500/50 border border-amber-500/70',
  },
  {
    value: 'purple',
    label: 'Purple',
    dotClass: 'bg-purple-500/50 border border-purple-500/70',
  },
  {
    value: 'rose',
    label: 'Rose',
    dotClass: 'bg-rose-500/50 border border-rose-500/70',
  },
  {
    value: 'cyan',
    label: 'Cyan',
    dotClass: 'bg-cyan-500/50 border border-cyan-500/70',
  },
]

interface CommentActionsMenuProps {
  /** Callback when Edit is selected */
  onEdit: () => void
  /** Callback when color is changed */
  onColorChange: (color: CommentColor) => void
  /** Callback when Delete is selected */
  onDelete: () => void
  /** Currently selected color */
  currentColor: CommentColor
  /** Whether the menu trigger is disabled */
  disabled?: boolean
}

/**
 * CommentActionsMenu Component
 *
 * A dropdown menu for comment actions with:
 * - Edit action
 * - Color picker submenu with 8 color options
 * - Delete action (destructive)
 *
 * The color submenu expands on hover, showing color options
 * with visual dots and checkmarks for the selected color.
 *
 * @example
 * <CommentActionsMenu
 *   onEdit={() => setIsEditing(true)}
 *   onColorChange={(color) => updateColor(color)}
 *   onDelete={() => clearComment()}
 *   currentColor="primary"
 * />
 */
export const CommentActionsMenu = memo<CommentActionsMenuProps>(
  ({ onEdit, onColorChange, onDelete, currentColor, disabled = false }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            disabled={disabled}
            aria-label="Comment actions"
            data-testid="comment-actions-trigger"
            onClick={(e) => e.stopPropagation()}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            data-testid="comment-action-edit"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="comment-action-color">
              <Palette className="mr-2 h-4 w-4" />
              Color
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-32">
              {COLOR_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={(e) => {
                    e.stopPropagation()
                    onColorChange(option.value)
                  }}
                  data-testid={`comment-color-${option.value}`}
                >
                  <span
                    className={`mr-2 h-3 w-3 rounded-full ${option.dotClass}`}
                  />
                  <span className="flex-1">{option.label}</span>
                  {currentColor === option.value && (
                    <Check className="ml-2 h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-destructive focus:text-destructive"
            data-testid="comment-action-delete"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  },
)

CommentActionsMenu.displayName = 'CommentActionsMenu'
