import * as Sentry from '@sentry/nextjs'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'

import { getUserRepoPlacements } from '@/lib/actions/board-data'
import type { RepoPlacements } from '@/lib/actions/repo-card-duplicates'

interface RepoPlacementsState {
  /** Latest placements, or `null` when the last fetch failed or none has run. */
  placements: RepoPlacements | null
  /** Whether the fetch for the current picker opening has finished. */
  isSettled: boolean
}

interface UseRepoPlacementsReturn {
  /**
   * Where the user's repositories are placed, or `null` when unknown (fetch
   * failed). Callers fall back to rendering without a held list; the server
   * still rejects a repository that is already placed.
   */
  placements: RepoPlacements | null
  /** True from the moment the picker opens until its placement fetch settles. */
  isLoadingPlacements: boolean
  /** Fetch placements again, e.g. after an add result that skipped repositories. */
  refreshPlacements: () => Promise<void>
}

const INITIAL_PLACEMENTS_STATE: RepoPlacementsState = {
  placements: null,
  isSettled: false,
}

/**
 * Loads where the user's repositories are placed every time the repository
 * picker opens.
 *
 * Called by {@link AddRepositoryCombobox}. Unlike {@link useRepositoryCatalog},
 * which caches the GitHub catalog for instant reopen, placements are fetched on
 * every open: they change whenever a card is added, moved, removed or restored,
 * possibly in another tab, and stale data would offer a repository the server
 * then rejects.
 *
 * @param isOpen - Whether the repository picker is currently open.
 * @returns The placements, a loading flag, and a manual refresh function.
 * @example
 * const { placements, isLoadingPlacements, refreshPlacements } = useRepoPlacements(isOpen)
 * // placements => { boards: [{ identifier: 'a/b', boardId: '…', boardName: 'Work' }], maintenance: [] }
 */
export function useRepoPlacements(isOpen: boolean): UseRepoPlacementsReturn {
  const [state, setState] = useState<RepoPlacementsState>(
    INITIAL_PLACEMENTS_STATE,
  )
  // Only the newest request may write state: close/reopen can overlap fetches.
  const latestRequestId = useRef(0)

  const refreshPlacements = useCallback(async (): Promise<void> => {
    const requestId = ++latestRequestId.current

    let placements: RepoPlacements | null = null
    try {
      const result = await getUserRepoPlacements()
      // A failed lookup is logged server-side; the picker degrades to no held list
      if (result.success) placements = result.data
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: 'fetchRepoPlacements' },
      })
    }

    // A newer request superseded this one
    if (requestId !== latestRequestId.current) return
    setState({ placements, isSettled: true })
  }, [])

  const loadPlacementsForOpening = useEffectEvent(() => {
    void refreshPlacements()
  })

  // Controlled picker open state triggers one Server Action per opening
  useEffect(() => {
    if (!isOpen) return

    loadPlacementsForOpening()

    return (): void => {
      // Closing invalidates any in-flight request and forgets the old data, so
      // the next opening shows loading instead of a stale held list.
      latestRequestId.current += 1
      setState(INITIAL_PLACEMENTS_STATE)
    }
  }, [isOpen])

  return {
    placements: state.placements,
    isLoadingPlacements: isOpen && !state.isSettled,
    refreshPlacements,
  }
}
