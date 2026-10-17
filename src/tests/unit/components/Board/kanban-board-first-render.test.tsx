/**
 * Unit Tests: a board is in the server HTML, and hydration keeps it
 *
 * The browser tests hydrate the board the server sent. Here the HTML comes
 * from `renderToString` and `hydrateRoot` takes it over, so the check does
 * not need a running app.
 *
 * @see src/components/Board/KanbanBoard.tsx
 */

import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/actions/board', () => ({
  updateRepoCardPosition: vi.fn(async () => ({})),
  batchUpdateRepoCardOrders: vi.fn(async () => ({})),
  swapStatusListPositions: vi.fn(async () => ({})),
  batchUpdateStatusListPositions: vi.fn(async () => ({})),
  updateStatusListPosition: vi.fn(async () => ({})),
}))

import { KanbanBoard } from '@/components/Board/KanbanBoard'
import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import boardReducer, { setStatusLists } from '@/lib/redux/slices/boardSlice'
import boardSyncReducer, {
  serverSnapshotApplied,
} from '@/lib/redux/slices/boardSyncSlice'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) act(() => root.unmount())
  document.body.replaceChildren()
})

/** A store with nothing on the board yet. */
function makeStore() {
  return configureStore({
    reducer: {
      board: boardReducer,
      boardSync: boardSyncReducer,
    },
  })
}

/** The Ideas column of board-1. */
function ideasColumn(): StatusListDomain {
  return {
    id: toStatusListId('col-ideas'),
    title: 'Ideas',
    color: '#6B7280',
    gridRow: 0,
    gridCol: 0,
    boardId: toBoardId('board-1'),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/** The gitbox card in Ideas. */
function gitboxCard(): RepoCardForRedux {
  return {
    id: toRepoCardId('card-gitbox'),
    title: 'laststance/gitbox',
    statusId: toStatusListId('col-ideas'),
    boardId: toBoardId('board-1'),
    repoOwner: 'laststance',
    repoName: 'gitbox',
    order: 0,
    meta: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/**
 * Renders the board on the server and hydrates that HTML.
 *
 * @param element - The tree, the same on both sides as Next.js sends it.
 * @returns The server's HTML and every error React reported while it took
 *   the HTML over.
 */
async function renderOnTheServerAndHydrate(element: ReactNode) {
  const serverHtml = renderToString(element)
  const container = document.createElement('div')
  container.append(
    ...new DOMParser().parseFromString(serverHtml, 'text/html').body.childNodes,
  )
  document.body.appendChild(container)

  const hydrationErrors: string[] = []
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  await act(async () => {
    mountedRoots.push(
      hydrateRoot(container, element, {
        onRecoverableError: (error) => hydrationErrors.push(String(error)),
      }),
    )
  })
  const consoleErrors = consoleError.mock.calls.map((call) =>
    call.map(String).join(' '),
  )
  consoleError.mockRestore()
  return { serverHtml, hydrationErrors, consoleErrors }
}

describe('the server HTML of a board', () => {
  // Value: protects=a slow load shows the columns the server already had, and hydration does not throw them away (TODOS.md server render); fails_when=the HTML is the skeleton or React reports a hydration error; why_new=the first render read an empty store; seam=none; no_claim=a drag after the store has the board
  test('contains the column and the card, and hydrates without an error', async () => {
    // Arrange
    const store = makeStore()
    const board = (
      <Provider store={store}>
        <KanbanBoard
          boardId="board-1"
          initialComments={{}}
          initialStatusLists={[ideasColumn()]}
          initialRepoCards={[gitboxCard()]}
        />
      </Provider>
    )

    // Act
    const { serverHtml, hydrationErrors, consoleErrors } =
      await renderOnTheServerAndHydrate(board)

    // Assert
    expect(serverHtml).toContain('Ideas')
    expect(serverHtml).toContain('laststance/gitbox')
    expect(serverHtml).not.toContain('animate-pulse')
    expect(hydrationErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  // Value: protects=a rename that the store already has is not replaced by the page data; fails_when=the old column name comes back; why_new=the page data takes over until the store holds this board, and must stop then; seam=none; no_claim=the database
  test('shows the store once this board has been put there', () => {
    // Arrange
    const store = makeStore()
    store.dispatch(setStatusLists([{ ...ideasColumn(), title: 'In progress' }]))
    store.dispatch(serverSnapshotApplied(toBoardId('board-1')))

    // Act
    render(
      <Provider store={store}>
        <KanbanBoard
          boardId="board-1"
          initialComments={{}}
          initialStatusLists={[ideasColumn()]}
          initialRepoCards={[]}
        />
      </Provider>,
    )

    // Assert
    expect(screen.getByText('In progress')).toBeVisible()
    expect(screen.queryByText('Ideas')).toBeNull()
  })
})
