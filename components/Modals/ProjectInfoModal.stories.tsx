/**
 * ProjectInfoModal Component Stories
 *
 * A modal dialog for editing project information including quick notes
 * and links (production, tracking, Supabase).
 * Features WCAG AA accessibility compliance.
 *
 * Interaction Tests:
 * - TestAutoFocus: Verify Note editor receives focus on modal open
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { ProjectInfoModal } from './ProjectInfoModal'

const meta = {
  title: 'Modals/ProjectInfoModal',
  component: ProjectInfoModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProjectInfoModal>

export default meta
type Story = StoryObj<typeof meta>

const mockProjectInfo = {
  id: 'project-1',
  note: 'This is a rich text note about the project',
  comment: 'Quick inline comment',
  links: [
    {
      type: 'production' as const,
      url: 'https://example.com',
    },
    {
      type: 'tracking' as const,
      url: 'https://tracking.example.com',
    },
  ],
}

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: (data) => {
      console.log('Saved:', data)
    },
    projectInfo: mockProjectInfo,
  },
}

export const Empty: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: (data) => {
      console.log('Saved:', data)
    },
    projectInfo: {
      id: 'project-2',
      note: '',
      comment: '',
      links: [],
    },
  },
}

export const WithAllLinks: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: (data) => {
      console.log('Saved:', data)
    },
    projectInfo: {
      ...mockProjectInfo,
      links: [
        {
          type: 'production' as const,
          url: 'https://production.example.com',
        },
        {
          type: 'tracking' as const,
          url: 'https://tracking.example.com',
        },
        {
          type: 'supabase' as const,
          url: 'https://supabase.example.com',
        },
      ],
    },
  },
}

export const WithLongNote: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: (data) => {
      console.log('Saved:', data)
    },
    projectInfo: {
      ...mockProjectInfo,
      note: 'This is a very long note that demonstrates the rich text capability. '.repeat(
        100,
      ),
    },
  },
}

// ============================================================================
// Interaction Tests (play functions)
// ============================================================================

/**
 * Test: Auto-focus on Note editor when modal opens
 *
 * Verifies that the PlateEditor (Note field) receives focus automatically
 * when the modal opens, similar to NoteModal behavior.
 */
export const TestAutoFocus: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onSave: () => {},
    projectInfo: {
      id: 'test-autofocus',
      note: '',
      comment: '',
      links: [],
    },
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step(
      'Wait for modal to render and editor to initialize',
      async () => {
        await waitFor(
          () => {
            const editor = canvas.getByTestId('note-editor')
            expect(editor).toBeInTheDocument()
          },
          { timeout: 2000 },
        )
      },
    )

    await step('Verify Note editor has focus', async () => {
      await waitFor(
        () => {
          // PlateEditor uses contenteditable, so check if focus is within the editor container
          const editor = canvas.getByTestId('note-editor')
          const activeElement = document.activeElement
          // Active element should be inside the editor (contenteditable div)
          expect(editor.contains(activeElement)).toBe(true)
        },
        { timeout: 2000 },
      )
    })
  },
}
