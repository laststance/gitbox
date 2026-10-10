'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { memo } from 'react'

import { ROUTES } from '@/lib/constants/routes'

/**
 * A catalog repository the user cannot add because it is already placed:
 * on another of their boards, or in Maintenance.
 *
 * @example
 * { id: 42, fullName: 'laststance/gitbox', location: { kind: 'board', boardId: 'uuid', boardName: 'Work' } }
 * { id: 43, fullName: 'laststance/old-project', location: { kind: 'maintenance' } }
 */
export interface HeldRepository {
  /** GitHub repository id (stable list key). */
  id: number
  /** `owner/name` as GitHub reports it. */
  fullName: string
  /** Where the repository currently lives. */
  location:
    | { kind: 'board'; boardId: string; boardName: string }
    | { kind: 'maintenance' }
}

interface HeldRepositoryListProps {
  /** Repositories already placed elsewhere, already filtered by the picker. */
  repositories: HeldRepository[]
}

/**
 * "Already placed elsewhere" list of the Add Repositories picker.
 *
 * Rendered by {@link AddRepositoryCombobox} as a sibling of the options
 * listbox. A repository may sit on only one board (Issue #215), so instead of
 * hiding the ones the user cannot add, this list says where each one lives and
 * links there. Rows are deliberately not `role="option"`: they are never
 * selectable, and a link inside an option is unreachable by keyboard.
 *
 * Renders nothing when the list is empty.
 */
export const HeldRepositoryList = memo(function HeldRepositoryList({
  repositories,
}: HeldRepositoryListProps) {
  if (repositories.length === 0) return null

  return (
    <section className="mt-3">
      <h3 className="text-muted-foreground text-xs font-medium">
        Already placed elsewhere ({repositories.length})
      </h3>
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
              <Link
                href={destination.href}
                // Do not prefetch a whole board page per held row
                prefetch={false}
                title={destination.label}
                aria-label={destination.accessibleName}
                // text-foreground + underline: text-primary is below AA contrast
                // in most themes. On touch screens the hit area is stretched
                // over the whole row (44px target); with a mouse the link stays
                // precise so the repository name above it can be selected.
                className="text-foreground focus-visible:ring-primary inline-flex max-w-full items-center gap-1 self-start rounded-sm text-sm underline underline-offset-4 hover:decoration-2 focus-visible:ring-2 focus-visible:outline-none pointer-coarse:after:absolute pointer-coarse:after:inset-0"
              >
                <span className="truncate">{destination.label}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
})

/**
 * Resolves the link target and copy for a held repository row.
 *
 * @param repository - The held repository to describe.
 * @returns
 * - On a board: `{ href: '/board/<id>', label: 'On <board name>', accessibleName: 'On <board name>, which holds owner/name' }`
 * - In Maintenance: `{ href: '/maintenance', label: 'In Maintenance', accessibleName: 'In Maintenance, which holds owner/name' }`
 *
 * The accessible name starts with the visible label so that speech-control
 * users can say what they see (WCAG 2.5.3 Label in Name).
 * @example
 * toDestination({ id: 1, fullName: 'a/b', location: { kind: 'board', boardId: 'x', boardName: 'Work' } })
 * // => { href: '/board/x', label: 'On Work', accessibleName: 'On Work, which holds a/b' }
 */
function toDestination(repository: HeldRepository): {
  href: string
  label: string
  accessibleName: string
} {
  if (repository.location.kind === 'maintenance') {
    return {
      href: ROUTES.MAINTENANCE,
      label: 'In Maintenance',
      accessibleName: `In Maintenance, which holds ${repository.fullName}`,
    }
  }

  return {
    href: `/board/${repository.location.boardId}`,
    label: `On ${repository.location.boardName}`,
    accessibleName: `On ${repository.location.boardName}, which holds ${repository.fullName}`,
  }
}
