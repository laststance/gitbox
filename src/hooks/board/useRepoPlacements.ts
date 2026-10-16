import * as Sentry from '@sentry/nextjs'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'

import type { BoardPlacement } from '@/lib/actions/repo-card-duplicates'
import type { SavedRepositoryMemory } from '@/lib/actions/saved-repository-memories'
import {
  fetchRepoPlacements,
  fetchSavedRepositoryMemories,
} from '@/lib/fetch-repo-placements'

interface RepoPlacementsState {
  /** Latest placements, or `null` when the last fetch failed or none has run. */
  placements: BoardPlacement[] | null
  /** What is saved for repositories on no board, or `null` when unknown. */
  savedMemories: SavedRepositoryMemory[] | null
  /** Whether the fetch for the current picker opening has finished. */
  isSettled: boolean
}

interface UseRepoPlacementsReturn {
  /**
   * Where the user's repositories are placed, or `null` when unknown (fetch
   * failed). Callers fall back to rendering without a held list; the server
   * still rejects a repository that is already placed.
   */
  placements: BoardPlacement[] | null
  /**
   * Repositories on no board whose note, links or comment are saved (issue
   * #216), or `null` while that request is still running or when it failed.
   * The picker then shows no marks. The list does not wait for them.
   */
  savedMemories: SavedRepositoryMemory[] | null
  /** True from the moment the picker opens until its placement fetch settles. */
  isLoadingPlacements: boolean
  /** Fetch placements again, e.g. after an add result that skipped repositories. */
  refreshPlacements: () => Promise<void>
}

const INITIAL_PLACEMENTS_STATE: RepoPlacementsState = {
  placements: null,
  savedMemories: null,
  isSettled: false,
}

/**
 * Loads where the user's repositories are placed every time the repository
 * picker opens, through a GET so the request is not queued behind the catalog
 * Server Action.
 *
 * Called by {@link AddRepositoryCombobox}. The last settled placements stay
 * on screen when the picker opens again, and `isLoadingPlacements` stays
 * true until this opening's placement answer arrives: the picker keeps those
 * rows non-interactive, so a repository that was placed in another tab cannot
 * be chosen from the stale list. The Saved marks are a second request. They
 * do not hold the list. Closing clears them, so the next opening shows none
 * until its own answer arrives: a mark from the previous opening can name a
 * repository that is on a board now. Closing also forgets an in-flight
 * answer. A refresh that finishes after the picker has closed does not
 * become the next opening's list.
 *
 * @param isOpen - Whether the repository picker is currently open.
 * @returns The placements, the saved memories, a loading flag, and a manual refresh.
 * @example
 * const { placements, savedMemories, isLoadingPlacements, refreshPlacements } =
 *   useRepoPlacements(isOpen)
 * // placements => [{ identifier: 'a/b', boardId: '…', boardName: 'Work' }]
 * // savedMemories => [{ identifier: 'a/c', hasNote: true, linkCount: 0, hasComment: false }]
 */
export function useRepoPlacements(isOpen: boolean): UseRepoPlacementsReturn {
  const [state, setState] = useState<RepoPlacementsState>(
    INITIAL_PLACEMENTS_STATE,
  )
  // Only the newest request may write state: close/reopen can overlap fetches.
  const latestRequestId = useRef(0)
  // A refresh asked for after the picker closed (e.g. by an add that was still
  // in flight) must not store placements for the next opening to start from.
  const isOpenRef = useRef(false)

  const refreshPlacements = useCallback(async (): Promise<void> => {
    const requestId = ++latestRequestId.current
    // Both start now. The list settles on the placements answer alone.
    const placementsPromise = Promise.resolve().then(fetchRepoPlacements)
    // The rejection handler is attached now. The picker may close, or a newer
    // opening may start, before this is awaited, and the request can fail
    // while placements are still in flight. Either way the rejection is
    // handled, and the mark is simply missing.
    const memoriesPromise = Promise.resolve()
      .then(fetchSavedRepositoryMemories)
      .then(
        (result): SavedRepositoryMemory[] | null =>
          result.success ? result.data : null,
        (error: unknown): null => {
          Sentry.captureException(error, {
            tags: { action: 'fetchSavedRepositoryMemories' },
          })
          return null
        },
      )

    let placements: BoardPlacement[] | null = null
    try {
      const result = await placementsPromise
      // A failed lookup is logged server-side; the picker degrades to no held list
      if (result.success) placements = result.data.placements
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: 'fetchRepoPlacements' },
      })
    }

    // A newer request superseded this one, or the picker closed meanwhile
    if (requestId !== latestRequestId.current || !isOpenRef.current) return
    setState((current) => ({ ...current, placements, isSettled: true }))

    const savedMemories = await memoriesPromise
    if (requestId !== latestRequestId.current || !isOpenRef.current) return
    setState((current) => ({ ...current, savedMemories }))
  }, [])

  const loadPlacementsForOpening = useEffectEvent(() => {
    void refreshPlacements()
  })

  // Each opening loads placements with a GET, beside the catalog action
  useEffect(() => {
    if (!isOpen) return

    isOpenRef.current = true
    loadPlacementsForOpening()

    return (): void => {
      // Closing invalidates any in-flight request. The last settled placements
      // stay, unsettled, so the next opening can show them while its own
      // request runs. Marks do not: a Saved label from this opening can name
      // a repository that another tab has since placed.
      isOpenRef.current = false
      latestRequestId.current += 1
      setState((current) => ({
        ...current,
        savedMemories: null,
        isSettled: false,
      }))
    }
  }, [isOpen])

  return {
    placements: state.placements,
    savedMemories: state.savedMemories,
    isLoadingPlacements: isOpen && !state.isSettled,
    refreshPlacements,
  }
}
