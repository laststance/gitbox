'use client'

import { memo } from 'react'
import { toast } from 'sonner'

import { InlineEditableText } from '@/components/ui/inline-editable-text'
import {
  updateBoardsPageSubtitle,
  updateBoardsPageTitle,
} from '@/lib/actions/user-settings'
import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'
import {
  BOARDS_PAGE_DEFAULTS,
  BOARDS_PAGE_SUBTITLE_MAX_LENGTH,
  BOARDS_PAGE_TITLE_MAX_LENGTH,
} from '@/lib/validations/user-settings'

interface BoardsPageHeaderProps {
  initialTitle: string | null
  initialSubtitle: string | null
}

/**
 * Inline-editable header for the /boards page.
 * Displays user-customized title and subtitle, falling back to defaults.
 * Persists changes to user_settings table via server actions.
 *
 * @param initialTitle - Custom title from DB, or null for default
 * @param initialSubtitle - Custom subtitle from DB, or null for default
 * @example
 * <BoardsPageHeader initialTitle={null} initialSubtitle={null} />
 * // Renders "My Boards" and default subtitle, both click-to-edit
 */
export const BoardsPageHeader = memo<BoardsPageHeaderProps>(
  function BoardsPageHeader({ initialTitle, initialSubtitle }) {
    return (
      // min-w-0 and wrap-break-word: a title or a subtitle without a space
      // (50 and 100 characters are allowed) has no place to break. In the
      // row it shares with "Create Board" from 640px on, this block could
      // not get narrower than that one word and pushed the button off the
      // screen. Now the block gives way and a word that is wider than its
      // line breaks. The row leaves the block 320px at least, so a word
      // that is not that long stays whole.
      <div className="min-w-0">
        <InlineEditableText
          value={initialTitle || BOARDS_PAGE_DEFAULTS.title}
          onSave={async (newTitle) => {
            const result = await updateBoardsPageTitle(newTitle)
            if (!result.success) {
              toast.error(result.error)
              throw new Error(result.error)
            }
          }}
          maxLength={BOARDS_PAGE_TITLE_MAX_LENGTH}
          as="h1"
          className="text-foreground text-3xl font-bold wrap-break-word"
          inputClassName="text-foreground text-3xl font-bold"
          ariaLabel="Boards page title"
          data-testid="boards-page-title"
        />
        <InlineEditableText
          value={initialSubtitle || BOARDS_PAGE_DEFAULTS.subtitle}
          onSave={async (newSubtitle) => {
            const result = await updateBoardsPageSubtitle(newSubtitle)
            if (!result.success) {
              toast.error(result.error)
              throw new Error(result.error)
            }
          }}
          maxLength={BOARDS_PAGE_SUBTITLE_MAX_LENGTH}
          placeholder="Add a description..."
          as="p"
          className="text-muted-foreground mt-2 wrap-break-word"
          inputClassName="text-muted-foreground"
          ariaLabel="Boards page subtitle"
          data-testid="boards-page-subtitle"
        />
      </div>
    )
  },
  areServerRenderedPropsEqual,
)
