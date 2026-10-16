/**
 * Runs the repository-id backfill after the picker has its answer.
 *
 * {@link getUserRepoPlacements} loads this file with a dynamic import. A
 * static import of `next/server` from the action module is bundled into the
 * Storybook browser, where `__dirname` does not exist. Called only from that
 * action. When `after` is unavailable the caller still returns the list.
 */

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'

import type { Database } from '@/lib/supabase/types'

import { backfillVerifiedRepositoryIds } from './verify-repository-identity'

/**
 * Confirms missing repository ids once the response has been sent.
 *
 * @param supabase - Authenticated client captured for the request.
 * @param userId - The signed-in user (`claims.sub`).
 * @example
 * scheduleRepositoryBackfill(supabase, claims.sub)
 */
export function scheduleRepositoryBackfill(
  supabase: SupabaseClient<Database>,
  userId: string,
): void {
  after(async (): Promise<void> => {
    try {
      await backfillVerifiedRepositoryIds(supabase, userId)
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: 'backfillVerifiedRepositoryIds' },
      })
    }
  })
}
