/**
 * PlateEditor Node Stories
 *
 * Stories that exercise specific Plate node components:
 * - BlockquoteElement (blockquote-node.tsx)
 * - CodeLeaf (code-node.tsx)
 * - HighlightLeaf (highlight-node.tsx)
 * - HrElement (hr-node.tsx)
 * - KbdLeaf (kbd-node.tsx)
 * - LinkElement (link-node.tsx)
 * - HeadingElement (heading-node.tsx)
 * - CodeBlockElement (code-block-node.tsx)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { PlateEditor } from './PlateEditor'

const meta = {
  title: 'Editor/PlateEditorNodes',
  component: PlateEditor,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PlateEditor>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Renders a blockquote element - tests BlockquoteElement component
 */
export const Blockquote: Story = {
  args: {
    initialValue: JSON.stringify([
      {
        type: 'blockquote',
        children: [
          {
            text: 'This is a blockquote. It should have a left border and italic styling.',
          },
        ],
      },
      {
        type: 'p',
        children: [{ text: 'Regular paragraph after blockquote.' }],
      },
    ]),
    minHeight: '200px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that blockquote element is rendered
    await waitFor(() => {
      const blockquote = canvasElement.querySelector('blockquote')
      expect(blockquote).toBeInTheDocument()
    })
  },
}

/**
 * Renders inline code - tests CodeLeaf component
 */
export const InlineCode: Story = {
  args: {
    initialValue: JSON.stringify([
      {
        type: 'p',
        children: [
          { text: 'Here is some ' },
          { text: 'inline code', code: true },
          { text: ' in a paragraph.' },
        ],
      },
    ]),
    minHeight: '200px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that code element is rendered
    await waitFor(() => {
      const codeElement = canvasElement.querySelector('code')
      expect(codeElement).toBeInTheDocument()
    })
  },
}

/**
 * Renders highlighted text - tests HighlightLeaf component
 */
export const HighlightedText: Story = {
  args: {
    initialValue: JSON.stringify([
      {
        type: 'p',
        children: [
          { text: 'This text is ' },
          { text: 'highlighted', highlight: true },
          { text: ' using the highlight leaf.' },
        ],
      },
    ]),
    minHeight: '200px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that mark (highlight) element is rendered
    await waitFor(() => {
      const markElement = canvasElement.querySelector('mark')
      expect(markElement).toBeInTheDocument()
    })
  },
}

/**
 * Renders horizontal rule - tests HrElement component
 */
export const HorizontalRule: Story = {
  args: {
    initialValue: JSON.stringify([
      {
        type: 'p',
        children: [{ text: 'Content before horizontal rule' }],
      },
      {
        type: 'hr',
        children: [{ text: '' }],
      },
      {
        type: 'p',
        children: [{ text: 'Content after horizontal rule' }],
      },
    ]),
    minHeight: '200px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that hr element is rendered
    await waitFor(() => {
      const hrElement = canvasElement.querySelector('hr')
      expect(hrElement).toBeInTheDocument()
    })
  },
}

/**
 * Renders keyboard shortcut styling - tests KbdLeaf component
 */
export const KeyboardShortcut: Story = {
  args: {
    initialValue: JSON.stringify([
      {
        type: 'p',
        children: [
          { text: 'Press ' },
          { text: 'Ctrl', kbd: true },
          { text: ' + ' },
          { text: 'S', kbd: true },
          { text: ' to save.' },
        ],
      },
    ]),
    minHeight: '200px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that kbd elements are rendered
    await waitFor(() => {
      const kbdElements = canvasElement.querySelectorAll('kbd')
      expect(kbdElements.length).toBeGreaterThan(0)
    })
  },
}

/**
 * Renders a link element - tests LinkElement component
 * Note: Link elements are inline elements within paragraphs
 */
export const Link: Story = {
  args: {
    initialValue: JSON.stringify([
      {
        type: 'p',
        children: [
          { text: 'Click here to visit ' },
          {
            type: 'a',
            url: 'https://github.com/laststance/gitbox',
            children: [{ text: 'GitBox on GitHub' }],
          },
          { text: ' for more info.' },
        ],
      },
    ]),
    minHeight: '200px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that link element is rendered
    await waitFor(() => {
      const linkElement = canvasElement.querySelector('a[href]')
      expect(linkElement).toBeInTheDocument()
      expect(linkElement?.getAttribute('href')).toBe(
        'https://github.com/laststance/gitbox',
      )
    })
    // Test mouseOver handler (line 31 in link-node.tsx)
    const linkElement = canvasElement.querySelector('a[href]')
    if (linkElement) {
      linkElement.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    }
  },
}

/**
 * Renders all heading levels - tests HeadingElement component
 */
export const Headings: Story = {
  args: {
    initialValue: JSON.stringify([
      { type: 'h1', children: [{ text: 'Heading Level 1' }] },
      { type: 'h2', children: [{ text: 'Heading Level 2' }] },
      { type: 'h3', children: [{ text: 'Heading Level 3' }] },
      { type: 'h4', children: [{ text: 'Heading Level 4' }] },
      { type: 'h5', children: [{ text: 'Heading Level 5' }] },
      { type: 'h6', children: [{ text: 'Heading Level 6' }] },
      { type: 'p', children: [{ text: 'Regular paragraph' }] },
    ]),
    minHeight: '300px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that heading elements are rendered
    await waitFor(() => {
      expect(canvasElement.querySelector('h1')).toBeInTheDocument()
      expect(canvasElement.querySelector('h2')).toBeInTheDocument()
      expect(canvasElement.querySelector('h3')).toBeInTheDocument()
    })
  },
}

/**
 * Renders code block - tests CodeBlockElement component
 */
export const CodeBlock: Story = {
  args: {
    initialValue: JSON.stringify([
      {
        type: 'p',
        children: [{ text: 'Here is a code example:' }],
      },
      {
        type: 'code_block',
        lang: 'typescript',
        children: [
          {
            type: 'code_line',
            children: [{ text: 'function hello() {' }],
          },
          {
            type: 'code_line',
            children: [{ text: '  console.log("Hello World");' }],
          },
          {
            type: 'code_line',
            children: [{ text: '}' }],
          },
        ],
      },
    ]),
    minHeight: '250px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that code block container is rendered
    await waitFor(() => {
      const preElement = canvasElement.querySelector('pre')
      expect(preElement).toBeInTheDocument()
    })
  },
}

/**
 * Mixed content with multiple node types
 */
export const MixedContent: Story = {
  args: {
    initialValue: JSON.stringify([
      { type: 'h1', children: [{ text: 'Documentation Title' }] },
      {
        type: 'p',
        children: [
          { text: 'This is a paragraph with ' },
          { text: 'bold', bold: true },
          { text: ', ' },
          { text: 'italic', italic: true },
          { text: ', and ' },
          { text: 'inline code', code: true },
          { text: '.' },
        ],
      },
      {
        type: 'blockquote',
        children: [{ text: 'Important quote to remember' }],
      },
      {
        type: 'p',
        children: [
          { text: 'Use keyboard shortcut ' },
          { text: 'Cmd', kbd: true },
          { text: '+' },
          { text: 'K', kbd: true },
          { text: ' to open command palette.' },
        ],
      },
      { type: 'hr', children: [{ text: '' }] },
      {
        type: 'code_block',
        lang: 'javascript',
        children: [
          { type: 'code_line', children: [{ text: '// Example code' }] },
          { type: 'code_line', children: [{ text: 'const x = 42;' }] },
        ],
      },
    ]),
    minHeight: '400px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Verify multiple node types are rendered
    await waitFor(() => {
      expect(canvasElement.querySelector('h1')).toBeInTheDocument()
      expect(canvasElement.querySelector('blockquote')).toBeInTheDocument()
      expect(canvasElement.querySelector('hr')).toBeInTheDocument()
    })
  },
}

/**
 * Table content - tests table node component
 */
export const Table: Story = {
  args: {
    initialValue: JSON.stringify([
      { type: 'p', children: [{ text: 'Here is a table:' }] },
      {
        type: 'table',
        children: [
          {
            type: 'tr',
            children: [
              {
                type: 'th',
                children: [{ type: 'p', children: [{ text: 'Header 1' }] }],
              },
              {
                type: 'th',
                children: [{ type: 'p', children: [{ text: 'Header 2' }] }],
              },
            ],
          },
          {
            type: 'tr',
            children: [
              {
                type: 'td',
                children: [{ type: 'p', children: [{ text: 'Cell 1' }] }],
              },
              {
                type: 'td',
                children: [{ type: 'p', children: [{ text: 'Cell 2' }] }],
              },
            ],
          },
        ],
      },
    ]),
    minHeight: '250px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    await waitFor(() => {
      const tableElement = canvasElement.querySelector('table')
      expect(tableElement).toBeInTheDocument()
    })
  },
}

/**
 * Todo list - tests BlockList/TodoLi/TodoMarker components
 */
export const TodoList: Story = {
  args: {
    initialValue: JSON.stringify([
      { type: 'p', children: [{ text: 'My Todo List:' }] },
      {
        type: 'p',
        listStyleType: 'todo',
        indent: 1,
        checked: false,
        children: [{ text: 'Complete unit tests' }],
      },
      {
        type: 'p',
        listStyleType: 'todo',
        indent: 1,
        checked: true,
        children: [{ text: 'Write documentation' }],
      },
      {
        type: 'p',
        listStyleType: 'todo',
        indent: 1,
        checked: false,
        children: [{ text: 'Review pull request' }],
      },
    ]),
    minHeight: '250px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that todo list items are rendered
    await waitFor(() => {
      const listItems = canvasElement.querySelectorAll('li')
      expect(listItems.length).toBeGreaterThan(0)
    })
    // Check that checkboxes are rendered
    await waitFor(() => {
      const checkboxes = canvasElement.querySelectorAll('[role="checkbox"]')
      expect(checkboxes.length).toBeGreaterThan(0)
    })
  },
}

/**
 * Ordered list - tests list with decimal style
 */
export const OrderedList: Story = {
  args: {
    initialValue: JSON.stringify([
      { type: 'p', children: [{ text: 'Steps to follow:' }] },
      {
        type: 'p',
        listStyleType: 'decimal',
        indent: 1,
        listStart: 1,
        children: [{ text: 'First step' }],
      },
      {
        type: 'p',
        listStyleType: 'decimal',
        indent: 1,
        listStart: 2,
        children: [{ text: 'Second step' }],
      },
      {
        type: 'p',
        listStyleType: 'decimal',
        indent: 1,
        listStart: 3,
        children: [{ text: 'Third step' }],
      },
    ]),
    minHeight: '250px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that ordered list is rendered
    await waitFor(() => {
      const olElement = canvasElement.querySelector('ol')
      expect(olElement).toBeInTheDocument()
    })
  },
}

/**
 * Unordered list - tests list with disc style
 */
export const UnorderedList: Story = {
  args: {
    initialValue: JSON.stringify([
      { type: 'p', children: [{ text: 'Features:' }] },
      {
        type: 'p',
        listStyleType: 'disc',
        indent: 1,
        children: [{ text: 'Fast performance' }],
      },
      {
        type: 'p',
        listStyleType: 'disc',
        indent: 1,
        children: [{ text: 'Easy to use' }],
      },
      {
        type: 'p',
        listStyleType: 'disc',
        indent: 1,
        children: [{ text: 'Well documented' }],
      },
    ]),
    minHeight: '250px',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => {
      expect(canvas.getByTestId('plate-editor')).toBeInTheDocument()
    })
    // Check that unordered list is rendered
    await waitFor(() => {
      const ulElement = canvasElement.querySelector('ul')
      expect(ulElement).toBeInTheDocument()
    })
  },
}
