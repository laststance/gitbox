/**
 * Arriving from the picker's "On <board>" link scrolls to that card and
 * focuses it, and only after this board's own cards are the ones on screen.
 *
 * @see src/hooks/board/useRevealLinkedCard.ts
 */

import { configureStore } from '@reduxjs/toolkit'
import { act, render } from '@testing-library/react'
import { memo, type ReactElement } from 'react'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useRevealLinkedCard } from '@/hooks/board/useRevealLinkedCard'
import type { RepoCardForRedux } from '@/lib/models/domain'
import boardReducer, { setRepoCards } from '@/lib/redux/slices/boardSlice'
import boardSyncReducer, {
  serverSnapshotApplied,
} from '@/lib/redux/slices/boardSyncSlice'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

const BOARD_ID = '00000000-0000-4000-8000-0000000000b1'
const OTHER_BOARD_ID = '00000000-0000-4000-8000-0000000000b2'
const CARD_ID = '00000000-0000-4000-8000-0000000000c2'

function makeCard(id: string, boardId: string): RepoCardForRedux {
  return {
    id: toRepoCardId(id),
    title: 'laststance/gitbox',
    statusId: toStatusListId('00000000-0000-4000-8000-0000000000a1'),
    boardId: toBoardId(boardId),
    repoOwner: 'laststance',
    repoName: 'gitbox',
    order: 0,
    meta: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function makeStore() {
  return configureStore({
    reducer: {
      board: boardReducer,
      boardSync: boardSyncReducer,
    },
  })
}

const Harness = memo(function Harness(): ReactElement {
  useRevealLinkedCard(toBoardId(BOARD_ID))
  return <div />
})

function mountCard(cardId: string): HTMLDivElement {
  const card = document.createElement('div')
  card.tabIndex = 0
  card.setAttribute('data-repo-card-id', cardId)
  card.scrollIntoView = vi.fn()
  document.body.append(card)
  return card
}

describe('useRevealLinkedCard', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', `/board/${BOARD_ID}?card=${CARD_ID}`)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
    window.history.replaceState({}, '', `/board/${BOARD_ID}`)
  })

  test('focuses the card from the held-row link once this board is showing', () => {
    // Arrange: the previous board is still what the store holds
    const card = mountCard(CARD_ID)
    const store = makeStore()
    store.dispatch(serverSnapshotApplied(toBoardId(OTHER_BOARD_ID)))
    store.dispatch(setRepoCards([makeCard(CARD_ID, OTHER_BOARD_ID)]))
    render(
      <Provider store={store}>
        <Harness />
      </Provider>,
    )
    expect(document.activeElement).not.toBe(card)
    expect(window.location.search).toBe(`?card=${CARD_ID}`)

    // Act: this board's cards replace the previous board
    act(() => {
      store.dispatch(setRepoCards([makeCard(CARD_ID, BOARD_ID)]))
      store.dispatch(serverSnapshotApplied(toBoardId(BOARD_ID)))
    })

    // Assert
    expect(card.scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      inline: 'center',
      behavior: 'auto',
    })
    expect(document.activeElement).toBe(card)
    expect(window.location.pathname).toBe(`/board/${BOARD_ID}`)
    expect(window.location.search).toBe('')
  })

  test('drops the card parameter when this board does not hold that card', () => {
    // Arrange: the named card is neither in the store nor on the page
    const store = makeStore()
    render(
      <Provider store={store}>
        <Harness />
      </Provider>,
    )

    // Act
    act(() => {
      store.dispatch(setRepoCards([]))
      store.dispatch(serverSnapshotApplied(toBoardId(BOARD_ID)))
    })

    // Assert
    expect(document.activeElement).toBe(document.body)
    expect(window.location.search).toBe('')
  })

  test('focuses the card when its column is drawn without a new card list', async () => {
    // Arrange: the store already holds the card, and the column is not drawn
    const store = makeStore()
    store.dispatch(setRepoCards([makeCard(CARD_ID, BOARD_ID)]))
    store.dispatch(serverSnapshotApplied(toBoardId(BOARD_ID)))
    render(
      <Provider store={store}>
        <Harness />
      </Provider>,
    )
    expect(window.location.search).toBe(`?card=${CARD_ID}`)

    // Act: the column mounts. The card list does not change.
    let card: HTMLDivElement
    await act(async () => {
      card = mountCard(CARD_ID)
      await Promise.resolve()
    })

    // Assert
    expect(document.activeElement).toBe(card!)
    expect(window.location.search).toBe('')
  })

  test('drops the card parameter when the column never draws the card', () => {
    // Arrange
    vi.useFakeTimers()
    const store = makeStore()
    store.dispatch(setRepoCards([makeCard(CARD_ID, BOARD_ID)]))
    store.dispatch(serverSnapshotApplied(toBoardId(BOARD_ID)))
    render(
      <Provider store={store}>
        <Harness />
      </Provider>,
    )
    expect(window.location.search).toBe(`?card=${CARD_ID}`)

    // Act
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Assert
    expect(window.location.search).toBe('')
    vi.useRealTimers()
  })
})
