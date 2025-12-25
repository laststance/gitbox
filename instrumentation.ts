/**
 * Next.js Instrumentation
 *
 * This file is automatically loaded by Next.js before the application starts.
 * Used to initialize MSW for server-side mocking in test environments.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log(
      '[instrumentation] APP_ENV:',
      process.env.APP_ENV,
      'NODE_ENV:',
      process.env.NODE_ENV,
    )

    // Check if MSW should be enabled
    const isMSWEnabled =
      process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK === 'true' &&
      (process.env.APP_ENV === 'test' || process.env.NODE_ENV === 'test')

    if (isMSWEnabled) {
      console.log('[MSW] Starting server-side MSW...')
      const { server } = await import('./mocks/server')
      server.listen({ onUnhandledRequest: 'bypass' })
      console.log('[MSW] Server-side MSW started')
    }
  }
}
