/**
 * NoteModal Component Stories
 *
 * A modal dialog for editing project notes with:
 * - Redux draft state persistence (survives browser close)
 * - Character count display with warning near 20000 limit
 * - Optimistic UI updates with Sonner toast notifications
 * - Automatic draft saving during typing
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { memo, useEffect } from 'react'

import { updateDraftNote } from '@/lib/redux/slices/draftSlice'
import { useAppDispatch } from '@/lib/redux/store'

import { NoteModal } from './NoteModal'

const meta = {
  title: 'Modals/NoteModal',
  component: NoteModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof NoteModal>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default state with a sample note
 */
export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: async (note) => {
      console.log('Saved note:', note)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    cardId: 'card-123',
    initialNote:
      'This is a sample project note.\n\nIt can contain multiple paragraphs and formatting.',
    cardTitle: 'laststance/gitbox',
  },
}

/**
 * Empty state with no initial note
 */
export const Empty: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: async (note) => {
      console.log('Saved note:', note)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    cardId: 'card-empty',
    initialNote: '',
    cardTitle: 'facebook/react',
  },
}

/**
 * Note approaching the 20000 character limit
 * Shows orange warning text for character count
 */
export const LongNote: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: async (note) => {
      console.log('Saved note length:', note.length)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    cardId: 'card-long',
    initialNote:
      'This is a very long note that approaches the character limit. '.repeat(
        300,
      ),
    cardTitle: 'vercel/next.js',
  },
}

/**
 * Decorator component to set up Redux draft state
 */
const WithDraftDecorator = memo(function WithDraftDecorator({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode {
  const dispatch = useAppDispatch()

  useEffect(() => {
    // Set up draft state for the card
    dispatch(
      updateDraftNote({
        cardId: 'card-draft',
        content:
          'This is an unsaved draft that was auto-saved.\n\nThe original note was different.',
      }),
    )
  }, [dispatch])

  return children
})

/**
 * Shows draft state indicator
 * Demonstrates Redux draft persistence feature
 */
export const WithDraft: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: async (note) => {
      console.log('Saved note:', note)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    cardId: 'card-draft',
    initialNote: 'Original note content from Supabase.',
    cardTitle: 'microsoft/typescript',
  },
  decorators: [
    (Story) => (
      <WithDraftDecorator>
        <Story />
      </WithDraftDecorator>
    ),
  ],
}
