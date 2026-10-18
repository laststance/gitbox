'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { memo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { COARSE_HIT_TARGET_CLASS } from '@/lib/constants/touch-target'
import { selectStatusLists } from '@/lib/redux/slices/boardSlice'
import { useAppSelector } from '@/lib/redux/store'
import type { BoardId, StatusListId } from '@/lib/types/brands'
import { linkedCardHref } from '@/lib/utils/linked-card'

import { MoveHereDialog } from './MoveHereDialog'

/**
 * A catalog repository the user cannot add because it is already placed on
 * another of their boards.
 *
 * @example
 * { id: 42, fullName: 'laststance/gitbox', boardId: 'uuid', boardName: 'Work', cardId: 'card-uuid' }
 */
export interface HeldRepository {
  /** GitHub repository id (stable list key). */
  id: number
  /** `owner/name` as GitHub reports it. */
  fullName: string
  /** Board that holds the repository. */
  boardId: string
  /** Display name of the board that holds the repository. */
  boardName: string
  /** Id of the card on that board. The link scrolls to it and focuses it. */
  cardId: string
}

interface HeldRepositoryListProps {
  /** Repositories already placed elsewhere, already filtered by the picker. */
  repositories: HeldRepository[]
  /** Board the picker is open on. Move Here sends the card there. */
  boardId: BoardId
  /** Column the picker was opened for. The move dialog starts with it. */
  defaultStatusId: StatusListId | null
  /** Reloads the held list after a move the server confirmed. */
  onMoved: () => void
  /**
   * Disables Move Here while this opening's placements are still on the way.
   * The row stays visible; a move from a stale placement must wait.
   */
  movesDisabled?: boolean
}

/**
 * "Already placed elsewhere" list of the Add Repositories picker.
 *
 * Rendered by {@link AddRepositoryCombobox} as a sibling of the options
 * listbox. A repository may sit on only one board (Issue #215), so instead of
 * hiding the ones the user cannot add, this list says where each one lives,
 * links there, and can move the card onto this board. Rows are deliberately
 * not `role="option"`: they are never selectable, and a link inside an option
 * is unreachable by keyboard.
 *
 * Renders nothing when the list is empty.
 */
export const HeldRepositoryList = memo(function HeldRepositoryList({
  repositories,
  boardId,
  defaultStatusId,
  movesDisabled = false,
  onMoved,
}: HeldRepositoryListProps) {
  const columns = useAppSelector(selectStatusLists)
  const [moving, setMoving] = useState<HeldRepository | null>(null)

  if (repositories.length === 0) return null

  return (
    // flex-col + min-h-16: in a panel that is short of room the list gives
    // up height, down to its heading and about one row
    <section className="mt-3 flex min-h-16 flex-col">
      {/* h2: the panel stands in the header, right under the board's h1 */}
      <h2 className="text-muted-foreground text-xs font-medium">
        Already placed elsewhere ({repositories.length})
      </h2>
      <ul
        aria-label="Already placed elsewhere"
        // About 3.5 rows: a cut-off row shows that the list scrolls
        className="border-border mt-1 max-h-46 overflow-y-auto rounded-md border"
      >
        {repositories.map((repository) => {
          const destination = toDestination(repository)
          return (
            <li
              key={repository.id}
              className="border-border relative flex min-h-11 flex-col justify-center border-b px-3 py-1.5 last:border-b-0"
            >
              <span
                title={repository.fullName}
                className="text-muted-foreground truncate text-sm"
              >
                {repository.fullName}
              </span>
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={destination.href}
                  // Do not prefetch a whole board page per held row
                  prefetch={false}
                  title={destination.label}
                  aria-label={destination.accessibleName}
                  // text-foreground + underline: text-primary is below AA contrast
                  // in most themes. relative: the coarse-pointer stretch covers
                  // the link, not the Move Here button beside it.
                  className={`text-foreground focus-visible:ring-primary inline-flex min-w-0 items-center gap-1 rounded-sm text-sm underline underline-offset-4 hover:decoration-2 focus-visible:ring-2 focus-visible:outline-none ${COARSE_HIT_TARGET_CLASS}`}
                >
                  <span className="truncate">{destination.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`z-10 h-7 shrink-0 px-2 ${COARSE_HIT_TARGET_CLASS}`}
                  disabled={columns.length === 0 || movesDisabled}
                  aria-label={`Move Here, ${repository.fullName}`}
                  onClick={() => setMoving(repository)}
                >
                  Move Here
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {moving && (
        <MoveHereDialog
          repository={moving}
          boardId={boardId}
          defaultStatusId={defaultStatusId}
          onClose={() => setMoving(null)}
          onMoved={onMoved}
        />
      )}
    </section>
  )
})

/**
 * Resolves the link target and copy for a held repository row.
 *
 * @param repository - The held repository to describe.
 * @returns `{ href: '/board/<id>?card=<card id>', label: 'On <board name>', accessibleName: 'On <board name>, which holds owner/name' }`
 *
 * The accessible name starts with the visible label so that speech-control
 * users can say what they see (WCAG 2.5.3 Label in Name).
 * @example
 * toDestination({ id: 1, fullName: 'a/b', boardId: 'x', boardName: 'Work', cardId: 'c' })
 * // => { href: '/board/x?card=c', label: 'On Work', accessibleName: 'On Work, which holds a/b' }
 */
function toDestination(repository: HeldRepository): {
  href: string
  label: string
  accessibleName: string
} {
  return {
    href: linkedCardHref(repository.boardId, repository.cardId),
    label: `On ${repository.boardName}`,
    accessibleName: `On ${repository.boardName}, which holds ${repository.fullName}`,
  }
}
