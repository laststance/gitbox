/**
 * Unit Test: dates the server renders and the browser hydrates
 *
 * The server renders a page in UTC (Vercel), the browser hydrates it in the
 * user's time zone. A date that both spelled with `toLocaleDateString`
 * differed for anything made between the two midnights, and React threw the
 * server's markup away: error #418 on every visit to /boards, seen on
 * production for a board made at 22:59 UTC (10/4 on the server, 10/5 in
 * Tokyo).
 *
 * The browser tests cannot see this: with MSW on, `MSWProvider` renders the
 * page only once the worker runs in the browser, so the server's HTML holds
 * none of it. Here the HTML comes from `renderToString` with `TZ=UTC`, and
 * `hydrateRoot` takes it over with `TZ=America/Los_Angeles`, where
 * 2024-01-01T00:00:00Z is still the last day of 2023.
 */

import type { ReactNode } from 'react'
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

// The card and its two dialogs; none of them is called here
vi.mock('@/lib/actions/board', () => ({
  toggleBoardFavorite: vi.fn(),
  renameBoardAction: vi.fn(),
  deleteBoardAction: vi.fn(),
}))

vi.mock('@/lib/actions/auth', () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children?: ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Import after mocks
import { AccountClient } from '@/app/account/AccountClient'
import { BoardCard } from '@/components/Boards/BoardCard'
import { LocalDate } from '@/components/LocalDate'
import type { Tables } from '@/lib/supabase/types'
import { toUserId } from '@/lib/types/brands'

const ZONE_OF_THE_TEST_RUN = process.env.TZ
const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) act(() => root.unmount())
  document.body.replaceChildren()
  // Assigning undefined would store the string "undefined", an invalid zone
  if (ZONE_OF_THE_TEST_RUN === undefined) delete process.env.TZ
  else process.env.TZ = ZONE_OF_THE_TEST_RUN
})

/**
 * Renders on a server in UTC and hydrates in a browser in Los Angeles.
 *
 * @param element - The tree, the same on both sides as Next.js sends it.
 * @returns The server's HTML, the container after hydration, and every
 *   error React reported while it took the HTML over.
 */
async function renderInUtcAndHydrateInLosAngeles(element: ReactNode) {
  process.env.TZ = 'UTC'
  const serverHtml = renderToString(element)
  const container = document.createElement('div')
  // DOMParser runs no script; its nodes become the page React takes over
  container.append(
    ...new DOMParser().parseFromString(serverHtml, 'text/html').body.childNodes,
  )
  document.body.appendChild(container)

  process.env.TZ = 'America/Los_Angeles'
  const hydrationErrors: string[] = []
  await act(async () => {
    mountedRoots.push(
      hydrateRoot(container, element, {
        onRecoverableError: (error) => hydrationErrors.push(String(error)),
      }),
    )
  })
  return { serverHtml, container, hydrationErrors }
}

const boardMadeAtMidnightUtc: Tables<'board'> = {
  id: 'board-1',
  name: 'Test Board',
  subtitle: null,
  user_id: 'user-1',
  created_at: '2024-01-01T00:00:00+00:00',
  updated_at: '2024-01-01T00:00:00+00:00',
  settings: null,
  position: 0,
  is_favorite: false,
  is_public: false,
  share_slug: null,
}

describe('dates the server renders and the browser hydrates', () => {
  test('a board card hydrates without a mismatch and shows the day the board was made where the user is', async () => {
    // Arrange
    const boardCard = (
      <BoardCard
        board={boardMadeAtMidnightUtc}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    // Act
    const { serverHtml, container, hydrationErrors } =
      await renderInUtcAndHydrateInLosAngeles(boardCard)

    // Assert
    expect(serverHtml).toContain('1/1/2024')
    expect(hydrationErrors).toEqual([])
    expect(container.querySelector('time')?.textContent).toBe('12/31/2023')
  })

  test('the account page hydrates without a mismatch and shows the day the account was linked where the user is', async () => {
    // Arrange
    const accountPage = (
      <AccountClient
        userProfile={{
          id: toUserId('user-1'),
          userName: 'octocat',
          linkedSince: '2024-01-01T00:00:00.000Z',
        }}
        accountData={{ boardsCount: 2, cardsCount: 5 }}
      />
    )

    // Act
    const { serverHtml, container, hydrationErrors } =
      await renderInUtcAndHydrateInLosAngeles(accountPage)

    // Assert
    expect(serverHtml).toContain('January 1, 2024')
    expect(hydrationErrors).toEqual([])
    expect(container.textContent).toContain('Linked since December 31, 2023')
  })

  test('a date carries its moment in the dateTime attribute, as the database returned it', async () => {
    // Arrange
    const date = (
      <LocalDate
        isoDate="2026-10-04T22:59:26.75583+00:00"
        dateStyle="numeric"
      />
    )

    // Act
    const { container, hydrationErrors } =
      await renderInUtcAndHydrateInLosAngeles(date)

    // Assert
    const time = container.querySelector('time')
    expect(hydrationErrors).toEqual([])
    expect(time?.getAttribute('dateTime')).toBe(
      '2026-10-04T22:59:26.75583+00:00',
    )
    expect(time?.textContent).toBe('10/4/2026')
  })
})
