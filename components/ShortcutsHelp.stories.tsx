/**
 * ShortcutsHelp Component Stories
 *
 * A modal dialog component displaying keyboard shortcuts help.
 * Accessible via the ? key and provides categorized shortcuts for navigation,
 * actions, and help. Features proper keyboard navigation, focus management,
 * and WCAG AA accessibility compliance.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ShortcutsHelp } from './ShortcutsHelp'

const meta = {
  title: 'Components/ShortcutsHelp',
  component: ShortcutsHelp,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ShortcutsHelp>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    defaultOpen: false,
  },
}

export const Opened: Story = {
  args: {
    defaultOpen: true,
  },
}
