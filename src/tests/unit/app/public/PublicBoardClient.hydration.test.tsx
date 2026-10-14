/**
 * Unit Test: the shared board hydrates in a browser with another locale
 *
 * `/public/<slug>` is rendered on the server and hydrated in the visitor's
 * browser. A star count spelled with `toLocaleString()` and no locale took
 * the server's locale on one side (1,234 in en-US) and the browser's on the
 * other (1.234 in de-DE), and React threw the server's markup away (#418).
 *
 * The browser tests cannot see this (MSW keeps the page out of the server's
 * HTML, see CLAUDE.md "Hydration"), and Node's default locale is fixed when
 * the process starts. So the HTML comes from `renderToString` as it is, and
 * while `hydrateRoot` takes it over, a number spelled without a locale is
 * spelled the way a browser set to German spells it.
 */

import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { PublicBoardClient } from '@/app/public/[slug]/PublicBoardClient'
import type { PublicBoardData } from '@/lib/actions/public-board'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) act(() => root.unmount())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

const sharedBoardWithAPopularRepository: PublicBoardData = {
  board: { name: 'Shared Board', subtitle: null },
  statusLists: [
    {
      id: toStatusListId('status-1'),
      title: 'To Do',
      color: '#ef4444',
      gridRow: 0,
      gridCol: 0,
      boardId: toBoardId('board-1'),
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  repoCards: [
    {
      id: toRepoCardId('card-1'),
      title: 'react',
      repoOwner: 'facebook',
      repoName: 'react',
      description: 'The library for web and native user interfaces.',
      statusId: toStatusListId('status-1'),
      boardId: toBoardId('board-1'),
      order: 0,
      meta: { stars: 1234, language: 'JavaScript' },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
}

describe('the shared board hydrates in a browser with another locale', () => {
  test('a star count hydrates without a mismatch in a browser set to German', async () => {
    // Arrange: the server's HTML, then a browser whose default locale is de-DE
    const sharedBoard = (
      <PublicBoardClient data={sharedBoardWithAPopularRepository} />
    )
    const serverHtml = renderToString(sharedBoard)
    const container = document.createElement('div')
    // DOMParser runs no script; its nodes become the page React takes over
    container.append(
      ...new DOMParser().parseFromString(serverHtml, 'text/html').body
        .childNodes,
    )
    document.body.appendChild(container)
    const spellNumber = Number.prototype.toLocaleString
    vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(
      function spellAsAGermanBrowser(
        this: number,
        locales?: Intl.LocalesArgument,
        options?: Intl.NumberFormatOptions,
      ) {
        return spellNumber.call(this, locales ?? 'de-DE', options)
      },
    )
    const hydrationErrors: string[] = []

    // Act
    await act(async () => {
      mountedRoots.push(
        hydrateRoot(container, sharedBoard, {
          onRecoverableError: (error) => hydrationErrors.push(String(error)),
        }),
      )
    })

    // Assert
    expect(serverHtml).toContain('1,234')
    expect(hydrationErrors).toEqual([])
    expect(container.textContent).toContain('1,234')
  })
})
