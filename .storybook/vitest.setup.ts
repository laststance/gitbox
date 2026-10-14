/**
 * Vitest Setup for Storybook
 *
 * Runs in the browser before each story file of Storybook's Vitest project.
 * The @storybook/addon-vitest applies project annotations automatically.
 *
 * Module mocks do not belong here: `vi.mock` in this file is put in place
 * while the tests run and can lose a race against a story file's own import.
 * Register them with `sb.mock` in `preview.tsx`.
 */

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
