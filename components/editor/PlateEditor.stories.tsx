/**
 * PlateEditor Component Stories
 *
 * Rich text editor using Plate.js with:
 * - Fixed and floating toolbars
 * - Slash commands (/ menu) for block insertion
 * - Text formatting, lists, tables, code blocks
 * - Markdown autoformat shortcuts
 *
 * @note AI feature is disabled - slash menu should NOT show AI option
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, userEvent, waitFor } from 'storybook/test'

import { PlateEditor } from './PlateEditor'

const meta = {
  title: 'Editor/PlateEditor',
  component: PlateEditor,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PlateEditor>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default empty editor state
 */
export const Default: Story = {
  args: {
    placeholder: 'Type / for commands...',
    minHeight: '200px',
  },
}

/**
 * Editor with initial plain text content
 */
export const WithInitialText: Story = {
  args: {
    initialValue: 'Hello, this is some initial content.',
    placeholder: 'Type / for commands...',
    minHeight: '200px',
  },
}

/**
 * Editor with rich JSON content (Slate format)
 */
export const WithRichContent: Story = {
  args: {
    initialValue: JSON.stringify([
      {
        type: 'h1',
        children: [{ text: 'Welcome to PlateEditor' }],
      },
      {
        type: 'p',
        children: [
          { text: 'This is a ' },
          { text: 'rich text', bold: true },
          { text: ' editor with ' },
          { text: 'various', italic: true },
          { text: ' formatting options.' },
        ],
      },
      {
        type: 'ul',
        children: [
          {
            type: 'li',
            children: [{ type: 'lic', children: [{ text: 'Bullet lists' }] }],
          },
          {
            type: 'li',
            children: [{ type: 'lic', children: [{ text: 'Numbered lists' }] }],
          },
          {
            type: 'li',
            children: [{ type: 'lic', children: [{ text: 'Todo lists' }] }],
          },
        ],
      },
    ]),
    placeholder: 'Type / for commands...',
    minHeight: '300px',
  },
}

/**
 * Disabled editor state
 */
export const Disabled: Story = {
  args: {
    initialValue: 'This editor is disabled and cannot be edited.',
    disabled: true,
    minHeight: '200px',
  },
}

/**
 * Editor with custom placeholder
 */
export const CustomPlaceholder: Story = {
  args: {
    placeholder: 'Start writing your notes here...',
    minHeight: '200px',
  },
}

/**
 * Editor with max height for scrolling
 */
export const WithMaxHeight: Story = {
  args: {
    initialValue: JSON.stringify([
      { type: 'h1', children: [{ text: 'Long Content Example' }] },
      ...Array.from({ length: 20 }, (_, i) => ({
        type: 'p',
        children: [
          {
            text: `Paragraph ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
          },
        ],
      })),
    ]),
    minHeight: '200px',
    maxHeight: '400px',
  },
}

/**
 * Editor with auto focus enabled
 */
export const AutoFocus: Story = {
  args: {
    placeholder: 'This editor is auto-focused',
    autoFocus: true,
    minHeight: '200px',
  },
}

/**
 * Test: Slash menu opens on '/' key and shows expected items
 *
 * Verifies that:
 * - Slash menu opens when typing '/'
 * - Basic blocks group is visible (Text, Heading 1, etc.)
 * - AI option is NOT visible (feature disabled)
 *
 * Note: Uses document.body queries for portal-rendered content
 */
export const SlashMenuNoAI: Story = {
  args: {
    placeholder: 'Type / to open slash menu',
    minHeight: '200px',
    autoFocus: true,
  },
  play: async ({ step }) => {
    const user = userEvent.setup()

    await step('Wait for editor to initialize and type /', async () => {
      await waitFor(
        () => {
          const editor = screen.getByTestId('plate-editor')
          expect(editor).toBeInTheDocument()
        },
        { timeout: 2000 },
      )

      const textbox = screen.getByRole('textbox')
      await user.click(textbox)
      await user.type(textbox, '/')
    })

    await step('Verify slash menu appears with Basic blocks', async () => {
      // Wait for portal-rendered menu to appear
      await waitFor(
        () => {
          // Query the entire document for portal content
          const basicBlocks =
            document.body.querySelector('[class*="combobox"]') ||
            document.body.textContent?.includes('Basic blocks')
          expect(basicBlocks).toBeTruthy()
        },
        { timeout: 3000 },
      )
    })

    await step('Verify AI option is NOT present in slash menu', async () => {
      // Since AI is disabled, search document for AI menu group
      // The AI group would have text content exactly "AI" as a group label
      const allTextNodes = document.body.querySelectorAll('*')
      let aiGroupFound = false
      allTextNodes.forEach((node) => {
        if (node.textContent?.trim() === 'AI' && node.tagName !== 'SCRIPT') {
          // Check if this looks like a menu group label
          const classes = node.className || ''
          if (
            classes.includes('group') ||
            classes.includes('label') ||
            node.closest('[role="group"]') ||
            node.closest('[role="listbox"]')
          ) {
            aiGroupFound = true
          }
        }
      })
      expect(aiGroupFound).toBe(false)
    })
  },
}
