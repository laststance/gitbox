/**
 * CommentDisplay Component
 *
 * Displays inline comments on RepoCard in Card-in-Card style.
 * Phase 3: Display only (read-only)
 * Phase 4: Will add inline editing
 *
 * UI Specification:
 * - Card-in-Card with left border accent
 * - Full text display (no truncation)
 * - Configurable styling (border color, background, font size/weight)
 * - Empty state with "+ Add comment" placeholder
 *
 * @see https://github.com/laststance/gitbox/issues/20
 */

'use client'

import { Plus } from 'lucide-react'
import { memo, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Combined card colors with background fill and border
 * Each color uses 20% bg opacity and 30% border opacity
 * for a cohesive, filled card appearance
 */
export const COMMENT_CARD_COLORS = {
  primary: 'bg-primary/20 border border-primary/30 hover:bg-primary/25',
  blue: 'bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/25',
  green: 'bg-green-500/20 border border-green-500/30 hover:bg-green-500/25',
  amber: 'bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/25',
  purple: 'bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/25',
  rose: 'bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/25',
  cyan: 'bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/25',
  neutral: 'bg-muted/20 border border-muted-foreground/30 hover:bg-muted/25',
} as const

/**
 * @deprecated Background is now part of COMMENT_CARD_COLORS. Kept for backward compatibility.
 */
export const COMMENT_BG_COLORS = {
  subtle: '',
  light: '',
  tinted: '',
  none: '',
} as const

/**
 * Font size presets for comment styling
 */
export const COMMENT_FONT_SIZES = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
} as const

/**
 * Font weight presets for comment styling
 */
export const COMMENT_FONT_WEIGHTS = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
} as const

/**
 * Comment style configuration
 */
export interface CommentStyleSettings {
  borderColor: keyof typeof COMMENT_CARD_COLORS
  /** @deprecated Background is now part of COMMENT_CARD_COLORS */
  backgroundColor?: keyof typeof COMMENT_BG_COLORS
  fontSize: keyof typeof COMMENT_FONT_SIZES
  fontWeight: keyof typeof COMMENT_FONT_WEIGHTS
}

/**
 * Default style settings
 */
export const DEFAULT_COMMENT_STYLE: CommentStyleSettings = {
  borderColor: 'neutral',
  fontSize: 'sm',
  fontWeight: 'normal',
}

interface CommentDisplayProps {
  /** Comment text to display */
  comment: string | null | undefined
  /** Callback when comment area is clicked (for editing) */
  onClick?: () => void
  /** Style configuration */
  style?: Partial<CommentStyleSettings>
  /** Whether to show the empty state */
  showEmptyState?: boolean
  /** Custom class name */
  className?: string
  /** Render function for action buttons (e.g., CommentActionsMenu) */
  renderActions?: () => ReactNode
}

/**
 * CommentDisplay Component
 *
 * Renders a comment in Card-in-Card style with configurable styling.
 * Shows empty state when no comment is present.
 *
 * @param comment - The comment text to display
 * @param onClick - Callback for click events (used for editing in Phase 4)
 * @param style - Styling configuration
 * @param showEmptyState - Whether to show "+ Add comment" when empty
 * @param className - Additional CSS classes
 * @returns
 * - When comment exists: Card-in-Card display with edit icon on hover
 * - When empty and showEmptyState: Dashed border placeholder
 * - When empty and !showEmptyState: null (nothing rendered)
 *
 * @example
 * // With comment
 * <CommentDisplay
 *   comment="npmリリース完了、当分は機能追加予定なし"
 *   onClick={() => setIsEditing(true)}
 * />
 *
 * @example
 * // Empty state
 * <CommentDisplay
 *   comment=""
 *   onClick={() => setIsEditing(true)}
 *   showEmptyState
 * />
 */
export const CommentDisplay = memo<CommentDisplayProps>(
  ({
    comment,
    onClick,
    style = {},
    showEmptyState = true,
    className,
    renderActions,
  }) => {
    const mergedStyle = { ...DEFAULT_COMMENT_STYLE, ...style }

    const cardColorClass = COMMENT_CARD_COLORS[mergedStyle.borderColor]
    const fontSizeClass = COMMENT_FONT_SIZES[mergedStyle.fontSize]
    const fontWeightClass = COMMENT_FONT_WEIGHTS[mergedStyle.fontWeight]

    // Empty state
    if (!comment || comment.trim() === '') {
      if (!showEmptyState) {
        return null
      }

      return (
        <div
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick?.()
            }
          }}
          role="button"
          tabIndex={0}
          data-testid="comment-empty-state"
          className={cn(
            'border-muted-foreground/30 rounded-md border-2 border-dashed p-3',
            'hover:border-muted-foreground/50 hover:bg-muted/10',
            'cursor-pointer transition-all duration-200',
            'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
            className,
          )}
        >
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" />
            <span>Add comment</span>
          </div>
        </div>
      )
    }

    // Comment display
    return (
      <div
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
          }
        }}
        role="button"
        tabIndex={0}
        data-testid="comment-display"
        className={cn(
          // Base styles - full rounded card with background fill
          'group relative cursor-pointer rounded-md p-3 transition-all duration-200',
          // Combined card color (bg + border from COMMENT_CARD_COLORS)
          cardColorClass,
          // Focus styles
          'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
          className,
        )}
      >
        {/* Text content */}
        <p
          className={cn(
            'text-foreground/90 leading-relaxed',
            fontSizeClass,
            fontWeightClass,
          )}
          data-testid="comment-text"
        >
          {comment}
        </p>

        {/* Action buttons (appears on hover) */}
        {renderActions && (
          <div className="absolute right-2 bottom-2">{renderActions()}</div>
        )}
      </div>
    )
  },
)

CommentDisplay.displayName = 'CommentDisplay'
