import * as Sentry from '@sentry/nextjs'

import { isMSWEnabled } from '@/lib/utils/isMSWEnabled'

/**
 * Initialize runtime instrumentation before requests reach server components.
 * Next.js calls this hook at process startup; test mode also starts MSW so
 * GitHub requests are intercepted before server rendering begins.
 *
 * @returns When Sentry and, in test mode, MSW are ready.
 * @example
 * ```ts
 * await register()
 * ```
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')

    // Initialize E2E request interception before server components issue requests.
    if (isMSWEnabled()) {
      const { server } = await import('../mocks/server')
      server.listen({ onUnhandledFrame: 'bypass' })
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
