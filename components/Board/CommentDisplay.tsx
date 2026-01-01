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
 * Border color presets for comment styling
 */
export const COMMENT_BORDER_COLORS = {
  primary: 'border-primary/40 hover:border-primary/60',
  blue: 'border-blue-400/40 hover:border-blue-400/60',
  green: 'border-green-400/40 hover:border-green-400/60',
  amber: 'border-amber-400/40 hover:border-amber-400/60',
  purple: 'border-purple-400/40 hover:border-purple-400/60',
  rose: 'border-rose-400/40 hover:border-rose-400/60',
  cyan: 'border-cyan-400/40 hover:border-cyan-400/60',
  neutral: 'border-muted-foreground/30 hover:border-muted-foreground/50',
} as const

/**
 * Background color presets for comment styling
 */
export const COMMENT_BG_COLORS = {
  subtle: 'bg-muted/20 hover:bg-muted/30',
  light: 'bg-muted/40 hover:bg-muted/50',
  tinted: 'bg-primary/5 hover:bg-primary/10',
  none: 'bg-transparent hover:bg-muted/10',
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
  borderColor: keyof typeof COMMENT_BORDER_COLORS
  backgroundColor: keyof typeof COMMENT_BG_COLORS
  fontSize: keyof typeof COMMENT_FONT_SIZES
  fontWeight: keyof typeof COMMENT_FONT_WEIGHTS
}

/**
 * Default style settings
 */
export const DEFAULT_COMMENT_STYLE: CommentStyleSettings = {
  borderColor: 'primary',
  backgroundColor: 'subtle',
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

    const borderColorClass = COMMENT_BORDER_COLORS[mergedStyle.borderColor]
    const bgColorClass = COMMENT_BG_COLORS[mergedStyle.backgroundColor]
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
            'border-2 border-dashed border-muted-foreground/30 rounded-md p-3',
            'hover:border-muted-foreground/50 hover:bg-muted/10',
            'cursor-pointer transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            className,
          )}
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Plus className="w-4 h-4" />
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
          // Base styles
          'relative border-l-4 rounded-r-md p-3 transition-all duration-200 cursor-pointer group',
          // Border color
          borderColorClass,
          // Background color
          bgColorClass,
          // Focus styles
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          className,
        )}
      >
        {/* Text content */}
        <p
          className={cn(
            'leading-relaxed text-foreground/90',
            fontSizeClass,
            fontWeightClass,
          )}
          data-testid="comment-text"
        >
          {comment}
        </p>

        {/* Action buttons (appears on hover) */}
        {renderActions && (
          <div className="absolute bottom-2 right-2">{renderActions()}</div>
        )}
      </div>
    )
  },
)

CommentDisplay.displayName = 'CommentDisplay'

export default CommentDisplay
