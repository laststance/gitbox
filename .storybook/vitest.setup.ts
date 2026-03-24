/**
 * Vitest Setup for Storybook
 *
 * Configures project annotations for testing stories with Vitest.
 * The @storybook/addon-vitest automatically handles the beforeAll hook.
 */
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview'
import { setProjectAnnotations } from '@storybook/nextjs-vite'

import * as projectAnnotations from './preview'

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

// Apply project annotations for testing stories
// The addon-vitest automatically loads Storybook's beforeAll hook
setProjectAnnotations([a11yAddonAnnotations, projectAnnotations])
