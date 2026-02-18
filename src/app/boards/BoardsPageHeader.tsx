'use client'

import { memo } from 'react'
import { toast } from 'sonner'

import { InlineEditableText } from '@/components/ui/inline-editable-text'
import {
  updateBoardsPageSubtitle,
  updateBoardsPageTitle,
} from '@/lib/actions/user-settings'
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
      <div>
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
          className="text-foreground text-3xl font-bold"
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
          className="text-muted-foreground mt-2"
          inputClassName="text-muted-foreground"
          ariaLabel="Boards page subtitle"
          data-testid="boards-page-subtitle"
        />
      </div>
    )
  },
)
