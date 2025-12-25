/**
 * Browser-side MSW Worker
 *
 * Sets up Mock Service Worker for browser environments.
 * Intercepts requests using a Service Worker registered at /mockServiceWorker.js
 *
 * @description
 * - Uses msw/browser for Service Worker-based request interception
 * - Only active when NEXT_PUBLIC_ENABLE_MSW_MOCK === 'true'
 * - Handlers are shared with server.ts for consistency
 *
 * @see https://mswjs.io/docs/integrations/browser
 */
import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'

/**
 * Browser-side MSW worker instance
 * This will intercept requests in the browser using a Service Worker
 */
export const worker = setupWorker(...handlers)
