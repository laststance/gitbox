/**
 * MSW Handlers Barrel Export
 *
 * Exports two handler sets:
 * - `handlers`: GitHub API only (used by Next.js server.ts/browser.ts for E2E)
 * - `storybookHandlers`: GitHub API + Supabase mocks (used by Storybook)
 *
 * @see https://mswjs.io/docs/concepts/request-handler
 */
import type { HttpHandler } from 'msw'

import { githubApiHandlers } from './github'
import { supabaseHandlers } from './supabase'

// Re-export individual handler groups for selective use
export { githubApiHandlers } from './github'
export {
  supabaseHandlers,
  supabaseAuthHandlers,
  supabaseDbHandlers,
} from './supabase'

/**
 * Handlers for Next.js (E2E + dev): GitHub API only
 *
 * Supabase calls go to real PostgREST via NEXT_PUBLIC_SUPABASE_URL.
 * Auth is handled by server-side code proxy (APP_ENV=test).
 */
export const handlers: HttpHandler[] = [...githubApiHandlers]

/**
 * Handlers for Storybook: GitHub API + Supabase mocks
 *
 * Storybook needs full mocking since there's no real backend.
 */
export const storybookHandlers: HttpHandler[] = [
  ...supabaseHandlers,
  ...githubApiHandlers,
]
