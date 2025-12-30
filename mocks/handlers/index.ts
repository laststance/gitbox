/**
 * MSW Handlers Barrel Export
 *
 * Combines all API handlers and exports shared mock data.
 * Used by browser.ts and server.ts to set up MSW workers.
 *
 * @see https://mswjs.io/docs/concepts/request-handler
 */
import type { HttpHandler } from 'msw'

import { githubApiHandlers } from './github'
import { supabaseHandlers } from './supabase'

// Re-export mock data and utilities for tests/stories
export { mockData, resetMockData } from './data'

// Re-export individual handler groups for selective use
export { githubApiHandlers } from './github'
export {
  supabaseHandlers,
  supabaseAuthHandlers,
  supabaseDbHandlers,
} from './supabase'

/**
 * Combined array of all MSW request handlers
 * Used by Storybook and tests to mock API requests
 */
export const handlers: HttpHandler[] = [
  ...supabaseHandlers,
  ...githubApiHandlers,
]
