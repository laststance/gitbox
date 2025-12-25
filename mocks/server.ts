/**
 * Server-side MSW Server
 *
 * Sets up Mock Service Worker for Node.js environments.
 * Intercepts requests during SSR, API routes, and Server Actions.
 *
 * @description
 * - Uses msw/node for Node.js-based request interception
 * - Active only when isMSWEnabled() returns true (requires test environment)
 * - Handlers are shared with browser.ts for consistency
 * - Used for E2E testing with production builds
 *
 * @see https://mswjs.io/docs/integrations/node
 */
import { setupServer } from 'msw/node'

import { handlers } from './handlers'

/**
 * Server-side MSW server instance
 * This will intercept requests on the server (Node.js) side
 * Used for SSR, API routes, Server Actions, and production builds in test environments
 */
export const server = setupServer(...handlers)
