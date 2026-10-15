'use client'

import { memo, useEffect } from 'react'

import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'
import { clearRefreshAttemptsAfterFailedRefresh } from '@/lib/utils/handle-github-token-missing'

/**
 * Clears the silent-refresh counter when this page is where the refresh
 * route sent the user after the attempt cap.
 *
 * The login page renders it. The query is read after mount because
 * sessionStorage is not available while the server renders the page.
 * It calls {@link clearRefreshAttemptsAfterFailedRefresh}.
 *
 * @returns Nothing. The counter is cleared after mount when the query matches.
 * @example
 * <ClearFailedRefreshAttempts />
 */
export const ClearFailedRefreshAttempts = memo(
  function ClearFailedRefreshAttempts(): null {
    useEffect(() => {
      const error = new URLSearchParams(window.location.search).get('error')
      clearRefreshAttemptsAfterFailedRefresh(error)
    }, [])

    return null
  },
  areServerRenderedPropsEqual,
)
