/**
 * Vitest Setup for Storybook
 *
 * Configures project annotations for testing stories with Vitest.
 * The @storybook/addon-vitest automatically handles the beforeAll hook.
 */
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview'
import { setProjectAnnotations } from '@storybook/nextjs-vite'

import * as projectAnnotations from './preview'

// Apply project annotations for testing stories
// The addon-vitest automatically loads Storybook's beforeAll hook
setProjectAnnotations([a11yAddonAnnotations, projectAnnotations])
