/**
 * EditableUrlItem Component Stories
 *
 * Inline editable URL item with pen icon trigger.
 * Tests display mode, edit mode, validation, and undo patterns.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { memo, useCallback, useState } from 'react'
import { Toaster } from 'sonner'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { EditableUrlItem, type ProjectLink } from './editable-url-item'
import type { UserPresetOption } from './link-type-combobox'

// Mock user presets
const mockUserPresets: UserPresetOption[] = [
  { id: '1', value: 'custom-docs', label: 'Custom Docs', icon: 'file-text' },
  { id: '2', value: 'internal-api', label: 'Internal API', icon: 'server' },
]

const meta: Meta<typeof EditableUrlItem> = {
  title: 'UI/EditableUrlItem',
  component: EditableUrlItem,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <>
        <Toaster position="bottom-right" />
        <div className="max-w-2xl">
          <Story />
        </div>
      </>
    ),
  ],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Disable all interactions',
    },
    autoEdit: {
      control: 'boolean',
      description: 'Start in edit mode',
    },
  },
}

export default meta
type Story = StoryObj<typeof EditableUrlItem>

// ============================================
// Display Mode Stories
// ============================================

/**
 * Default display mode with a URL
 */
const DisplayModeStory = memo(function DisplayModeStory() {
  const [link, setLink] = useState<ProjectLink>({
    type: 'vercel',
    url: 'https://gitbox-laststance.vercel.app',
  })

  const handleUrlChange = useCallback((url: string) => {
    setLink((prev) => ({ ...prev, url }))
  }, [])

  const handleTypeChange = useCallback((type: string) => {
    setLink((prev) => ({ ...prev, type }))
  }, [])

  return (
    <EditableUrlItem
      link={link}
      index={0}
      onUrlChange={handleUrlChange}
      onTypeChange={handleTypeChange}
      onDelete={() => alert('Delete clicked')}
      userPresets={mockUserPresets}
      onAddCustomClick={() => alert('Add custom clicked')}
    />
  )
})

export const DisplayMode: Story = {
  render: () => <DisplayModeStory />,
}

/**
 * Display mode without URL (empty state)
 */
const EmptyUrlStory = memo(function EmptyUrlStory() {
  const [link, setLink] = useState<ProjectLink>({
    type: 'github',
    url: '',
  })

  return (
    <EditableUrlItem
      link={link}
      index={0}
      onUrlChange={(url) => setLink((prev) => ({ ...prev, url }))}
      onTypeChange={(type) => setLink((prev) => ({ ...prev, type }))}
      onDelete={() => {}}
      userPresets={mockUserPresets}
      onAddCustomClick={() => {}}
    />
  )
})

export const EmptyUrl: Story = {
  render: () => <EmptyUrlStory />,
}

// ============================================
// Edit Mode Stories
// ============================================

/**
 * Auto-edit mode (for newly added items)
 */
const AutoEditModeStory = memo(function AutoEditModeStory() {
  const [link, setLink] = useState<ProjectLink>({
    type: 'sentry',
    url: '',
  })

  return (
    <EditableUrlItem
      link={link}
      index={0}
      onUrlChange={(url) => setLink((prev) => ({ ...prev, url }))}
      onTypeChange={(type) => setLink((prev) => ({ ...prev, type }))}
      onDelete={() => {}}
      userPresets={mockUserPresets}
      onAddCustomClick={() => {}}
      autoEdit
    />
  )
})

export const AutoEditMode: Story = {
  render: () => <AutoEditModeStory />,
}

// ============================================
// Validation Stories
// ============================================

/**
 * Invalid URL (protocol not allowed)
 */
const InvalidProtocolStory = memo(function InvalidProtocolStory() {
  const [link, setLink] = useState<ProjectLink>({
    type: 'custom',
    url: '',
  })

  return (
    <EditableUrlItem
      link={link}
      index={0}
      onUrlChange={(url) => setLink((prev) => ({ ...prev, url }))}
      onTypeChange={(type) => setLink((prev) => ({ ...prev, type }))}
      onDelete={() => {}}
      userPresets={mockUserPresets}
      onAddCustomClick={() => {}}
      autoEdit
    />
  )
})

export const InvalidProtocol: Story = {
  render: () => <InvalidProtocolStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByTestId('url-input-0')

    // Type invalid protocol
    await userEvent.clear(input)
    await userEvent.type(input, 'javascript:alert(1)')

    // Wait for debounced validation
    await waitFor(
      () => {
        expect(
          canvas.getByText('URL must start with http:// or https://'),
        ).toBeInTheDocument()
      },
      { timeout: 500 },
    )
  },
}

// ============================================
// Delete with Undo Stories
// ============================================

/**
 * Delete with undo toast
 */
const DeleteWithUndoStory = memo(function DeleteWithUndoStory() {
  const [links, setLinks] = useState<ProjectLink[]>([
    { type: 'vercel', url: 'https://vercel.com/project' },
    { type: 'github', url: 'https://github.com/org/repo' },
  ])
  const [deletedLink, setDeletedLink] = useState<{
    link: ProjectLink
    index: number
  } | null>(null)

  const handleDelete = useCallback(
    (index: number) => {
      const linkToDelete = links[index]
      if (!linkToDelete) return
      setDeletedLink({ link: linkToDelete, index })
      setLinks((prev) => prev.filter((_, i) => i !== index))
    },
    [links],
  )

  const handleUndoDelete = useCallback(() => {
    if (!deletedLink) return
    const { link, index } = deletedLink
    setLinks((prev) => {
      const newLinks = [...prev]
      newLinks.splice(Math.min(index, prev.length), 0, link)
      return newLinks
    })
    setDeletedLink(null)
  }, [deletedLink])

  return (
    <div className="space-y-3">
      {links.map((link, index) => (
        <EditableUrlItem
          key={`${link.type}-${index}`}
          link={link}
          index={index}
          onUrlChange={(url) =>
            setLinks((prev) =>
              prev.map((l, i) => (i === index ? { ...l, url } : l)),
            )
          }
          onTypeChange={(type) =>
            setLinks((prev) =>
              prev.map((l, i) => (i === index ? { ...l, type } : l)),
            )
          }
          onDelete={() => handleDelete(index)}
          onUndoDelete={handleUndoDelete}
          userPresets={mockUserPresets}
          onAddCustomClick={() => {}}
        />
      ))}
    </div>
  )
})

export const DeleteWithUndo: Story = {
  render: () => <DeleteWithUndoStory />,
}

// ============================================
// Single Edit Coordination Stories
// ============================================

/**
 * Multiple items with single-edit coordination
 */
const SingleEditCoordinationStory = memo(
  function SingleEditCoordinationStory() {
    const [links, setLinks] = useState<ProjectLink[]>([
      { type: 'vercel', url: 'https://vercel.com/project' },
      { type: 'github', url: 'https://github.com/org/repo' },
      { type: 'sentry', url: 'https://sentry.io/project' },
    ])
    const [editingIndex, setEditingIndex] = useState<number | null>(null)

    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          Click a pen icon to edit. Only one item can be edited at a time.
        </p>
        {links.map((link, index) => (
          <EditableUrlItem
            key={`${link.type}-${index}`}
            link={link}
            index={index}
            onUrlChange={(url) =>
              setLinks((prev) =>
                prev.map((l, i) => (i === index ? { ...l, url } : l)),
              )
            }
            onTypeChange={(type) =>
              setLinks((prev) =>
                prev.map((l, i) => (i === index ? { ...l, type } : l)),
              )
            }
            onDelete={() =>
              setLinks((prev) => prev.filter((_, i) => i !== index))
            }
            userPresets={mockUserPresets}
            onAddCustomClick={() => {}}
            onEditStart={() => setEditingIndex(index)}
            forceExitEdit={editingIndex !== null && editingIndex !== index}
          />
        ))}
      </div>
    )
  },
)

export const SingleEditCoordination: Story = {
  render: () => <SingleEditCoordinationStory />,
}

// ============================================
// Disabled State Story
// ============================================

/**
 * Disabled state
 */
export const Disabled: Story = {
  args: {
    link: { type: 'vercel', url: 'https://vercel.com' },
    index: 0,
    onUrlChange: fn(),
    onTypeChange: fn(),
    onDelete: fn(),
    userPresets: mockUserPresets,
    onAddCustomClick: fn(),
    disabled: true,
  },
}

// ============================================
// Interaction Tests
// ============================================

/**
 * Test: Click pen icon to enter edit mode
 */
export const TestEditModeEntry: Story = {
  args: {
    link: { type: 'vercel', url: 'https://vercel.com' },
    index: 0,
    onUrlChange: fn(),
    onTypeChange: fn(),
    onDelete: fn(),
    userPresets: mockUserPresets,
    onAddCustomClick: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Find and click pen button
    const penButton = canvas.getByTestId('url-edit-0')
    await userEvent.click(penButton)

    // Verify input appears
    await waitFor(() => {
      expect(canvas.getByTestId('url-input-0')).toBeInTheDocument()
    })
  },
}

/**
 * Test: Enter key saves and exits edit mode
 */
const EnterSaveStory = memo(function EnterSaveStory() {
  const [link, setLink] = useState<ProjectLink>({
    type: 'github',
    url: 'https://github.com/old',
  })

  return (
    <EditableUrlItem
      link={link}
      index={0}
      onUrlChange={(url) => setLink((prev) => ({ ...prev, url }))}
      onTypeChange={(type) => setLink((prev) => ({ ...prev, type }))}
      onDelete={() => {}}
      userPresets={mockUserPresets}
      onAddCustomClick={() => {}}
      autoEdit
    />
  )
})

export const TestEnterSave: Story = {
  render: () => <EnterSaveStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByTestId('url-input-0')

    // Change URL and press Enter
    await userEvent.clear(input)
    await userEvent.type(input, 'https://github.com/new{Enter}')

    // Verify exit edit mode - link should appear
    await waitFor(() => {
      expect(canvas.getByTestId('url-link-0')).toBeInTheDocument()
    })
  },
}

/**
 * Test: Escape key cancels edit
 */
const EscapeCancelStory = memo(function EscapeCancelStory() {
  const [link, setLink] = useState<ProjectLink>({
    type: 'github',
    url: 'https://github.com/original',
  })

  return (
    <EditableUrlItem
      link={link}
      index={0}
      onUrlChange={(url) => setLink((prev) => ({ ...prev, url }))}
      onTypeChange={(type) => setLink((prev) => ({ ...prev, type }))}
      onDelete={() => {}}
      userPresets={mockUserPresets}
      onAddCustomClick={() => {}}
      autoEdit
    />
  )
})

export const TestEscapeCancel: Story = {
  render: () => <EscapeCancelStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByTestId('url-input-0')

    // Type something different
    await userEvent.clear(input)
    await userEvent.type(input, 'https://different.com')

    // Press Escape
    await userEvent.keyboard('{Escape}')

    // Verify original URL is shown (edit cancelled)
    await waitFor(() => {
      const link = canvas.getByTestId('url-link-0')
      expect(link).toHaveTextContent('https://github.com/original')
    })
  },
}

/**
 * Test: URL opens in new tab on click (display mode)
 */
export const TestUrlOpensNewTab: Story = {
  args: {
    link: { type: 'vercel', url: 'https://vercel.com' },
    index: 0,
    onUrlChange: fn(),
    onTypeChange: fn(),
    onDelete: fn(),
    userPresets: mockUserPresets,
    onAddCustomClick: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = canvas.getByTestId('url-link-0')

    // Verify link has correct attributes
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('href', 'https://vercel.com')
  },
}
