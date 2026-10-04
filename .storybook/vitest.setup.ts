/**
 * Vitest Setup for Storybook
 *
 * Configures browser-only mocks for Storybook's Vitest project.
 * The @storybook/addon-vitest applies project annotations automatically.
 */
import { vi } from 'vitest'

/**
 * Storybook browser tests render components without a Next.js server, so server
 * actions must resolve successfully for optimistic UI stories to pass.
 */
vi.mock('@/lib/actions/board', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/actions/board')>()

  return {
    ...actual,
    toggleBoardFavorite: vi.fn().mockResolvedValue({ success: true }),
  }
})

// Suppress benign ResizeObserver loop error in browser tests.
// This fires when ResizeObserver can't deliver all notifications in a single
// animation frame — it's not an actual error and is safe to ignore.
// See: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#observation_errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message?.includes('ResizeObserver loop')) {
      event.stopImmediatePropagation()
      event.preventDefault()
    }
  })
}
