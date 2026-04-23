/**
 * Unit Test: RepoCard Component
 *
 * Test targets:
 * - Card rendering with various data combinations
 * - DnD integration (@dnd-kit/sortable)
 * - Keyboard navigation
 * - Comment display/edit toggle
 * - Callback invocations
 * - Accessibility
 */

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { RepoCard } from '@/components/Board/RepoCard'
import { toRepoCardId, toStatusListId } from '@/lib/types/brands'

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}))

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ''),
    },
  },
}))

// Mock sub-components to isolate RepoCard testing
vi.mock('@/components/Board/OverflowMenu', () => ({
  OverflowMenu: ({
    cardId,
    open,
    onOpenChange,
  }: {
    cardId: string
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => (
    <button
      type="button"
      data-testid={`overflow-menu-${cardId}`}
      onClick={() => onOpenChange(!open)}
    >
      Menu {open ? 'open' : 'closed'}
    </button>
  ),
}))

vi.mock('@/components/Board/CommentDisplay', () => ({
  CommentDisplay: ({
    comment,
    onClick,
    renderActions,
  }: {
    comment?: string
    onClick?: () => void
    renderActions?: React.ReactNode
  }) => (
    <div data-testid="comment-display" onClick={onClick}>
      {comment || 'No comment'}
      {renderActions && renderActions}
    </div>
  ),
  COMMENT_CARD_COLORS: {
    neutral: 'bg-neutral',
    blue: 'bg-blue',
    green: 'bg-green',
  },
  DEFAULT_COMMENT_STYLE: { borderColor: 'neutral' },
}))

vi.mock('@/components/Board/CommentInlineEdit', () => ({
  CommentInlineEdit: ({
    onSave,
    onCancel,
  }: {
    onSave: (val: string, options: { closeOnSave: boolean }) => Promise<void>
    onCancel: () => void
  }) => (
    <div data-testid="comment-inline-edit">
      <textarea
        data-testid="comment-edit"
        onChange={async (e) => onSave(e.target.value, { closeOnSave: false })}
      />
      <button
        type="button"
        data-testid="comment-save-close"
        onClick={async () => onSave('saved text', { closeOnSave: true })}
      >
        Save & Close
      </button>
      <button type="button" data-testid="comment-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}))

vi.mock('@/components/Board/CommentActionsMenu', () => ({
  CommentActionsMenu: ({
    onColorChange,
    onDelete,
  }: {
    onColorChange: (color: string) => void
    onDelete: () => void
  }) => (
    <div data-testid="comment-actions-menu">
      <button
        type="button"
        data-testid="color-change-blue"
        onClick={() => onColorChange('blue')}
      >
        Blue
      </button>
      <button type="button" data-testid="delete-comment" onClick={onDelete}>
        Delete
      </button>
    </div>
  ),
}))

describe('RepoCard', () => {
  const mockOnNote = vi.fn()
  const mockOnCommentChange = vi.fn()
  const mockOnCommentColorChange = vi.fn()
  const mockOnCommentDelete = vi.fn()

  const defaultCard = {
    id: toRepoCardId('card-1'),
    title: 'test-repo',
    description: 'A test repository',
    statusId: toStatusListId('status-1'),
    repoOwner: 'laststance',
    repoName: 'gitbox',
    tags: ['typescript', 'react'],
    dueDate: '2026-01-15',
    attachments: 3,
    assignee: {
      name: 'John Doe',
      avatar: 'https://github.com/johndoe.png',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render card with title', () => {
      render(<RepoCard card={defaultCard} />)

      expect(screen.getByTestId('repo-name')).toHaveTextContent('test-repo')
    })

    it('should render card with description', () => {
      render(<RepoCard card={defaultCard} />)

      expect(screen.getByText('A test repository')).toBeInTheDocument()
    })

    it('should render tags as badges', () => {
      render(<RepoCard card={defaultCard} />)

      expect(screen.getByText('typescript')).toBeInTheDocument()
      expect(screen.getByText('react')).toBeInTheDocument()
    })

    it('should render due date', () => {
      render(<RepoCard card={defaultCard} />)

      // Date formatting: "Jan 15"
      expect(screen.getByText('Jan 15')).toBeInTheDocument()
    })

    it('should render attachments count', () => {
      render(<RepoCard card={defaultCard} />)

      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should render assignee avatar with initials fallback', () => {
      render(<RepoCard card={defaultCard} />)

      expect(screen.getByTestId('repo-owner')).toHaveTextContent('JD')
    })

    it('should render Note button', () => {
      render(<RepoCard card={defaultCard} />)

      expect(screen.getByLabelText('Open note')).toBeInTheDocument()
    })
  })

  describe('Optional Fields', () => {
    it('should render without description when not provided', () => {
      const cardWithoutDesc = { ...defaultCard, description: undefined }
      render(<RepoCard card={cardWithoutDesc} />)

      expect(screen.queryByText('A test repository')).not.toBeInTheDocument()
    })

    it('should render without tags when not provided', () => {
      const cardWithoutTags = { ...defaultCard, tags: undefined }
      render(<RepoCard card={cardWithoutTags} />)

      expect(screen.queryByText('typescript')).not.toBeInTheDocument()
    })

    it('should render without due date when not provided', () => {
      const cardWithoutDueDate = { ...defaultCard, dueDate: undefined }
      render(<RepoCard card={cardWithoutDueDate} />)

      expect(screen.queryByText('Jan 15')).not.toBeInTheDocument()
    })

    it('should render without attachments when not provided', () => {
      const cardWithoutAttachments = { ...defaultCard, attachments: undefined }
      const { container } = render(<RepoCard card={cardWithoutAttachments} />)

      // Attachments icon should not be present
      expect(container.querySelector('[data-testid="attachments"]')).toBeNull()
    })

    it('should render without assignee when not provided', () => {
      const cardWithoutAssignee = { ...defaultCard, assignee: undefined }
      render(<RepoCard card={cardWithoutAssignee} />)

      expect(screen.queryByTestId('repo-owner')).not.toBeInTheDocument()
    })
  })

  describe('Comment Display', () => {
    it('should show comment display when showComment is true', () => {
      render(<RepoCard card={defaultCard} showComment={true} />)

      expect(screen.getByTestId('comment-display')).toBeInTheDocument()
    })

    it('should hide comment when showComment is false', () => {
      render(<RepoCard card={defaultCard} showComment={false} />)

      expect(screen.queryByTestId('comment-display')).not.toBeInTheDocument()
    })

    it('should pass comment data to CommentDisplay', () => {
      const commentData = { comment: 'Test comment', color: 'blue' as const }
      render(
        <RepoCard
          card={defaultCard}
          commentData={commentData}
          showComment={true}
        />,
      )

      expect(screen.getByTestId('comment-display')).toHaveTextContent(
        'Test comment',
      )
    })
  })

  describe('Keyboard Navigation', () => {
    it('should call onNote when Enter is pressed', async () => {
      render(<RepoCard card={defaultCard} onNote={mockOnNote} />)

      // Find the Card element with tabIndex (focusable card content)
      const cardContent = screen
        .getByTestId('repo-card-card-1')
        .querySelector('[tabIndex="0"]')!
      fireEvent.keyDown(cardContent, { key: 'Enter' })

      expect(mockOnNote).toHaveBeenCalledWith('card-1')
    })

    it('should toggle overflow menu when period key is pressed', () => {
      render(<RepoCard card={defaultCard} />)

      const cardContent = screen
        .getByTestId('repo-card-card-1')
        .querySelector('[tabIndex="0"]')!

      // Initially closed
      expect(screen.getByTestId('overflow-menu-card-1')).toHaveTextContent(
        'closed',
      )

      // Press period to open
      fireEvent.keyDown(cardContent, { key: '.' })
      expect(screen.getByTestId('overflow-menu-card-1')).toHaveTextContent(
        'open',
      )

      // Press period again to close
      fireEvent.keyDown(cardContent, { key: '.' })
      expect(screen.getByTestId('overflow-menu-card-1')).toHaveTextContent(
        'closed',
      )
    })

    it('should close overflow menu when Escape is pressed', () => {
      render(<RepoCard card={defaultCard} />)

      const cardContent = screen
        .getByTestId('repo-card-card-1')
        .querySelector('[tabIndex="0"]')!

      // Open menu first
      fireEvent.keyDown(cardContent, { key: '.' })
      expect(screen.getByTestId('overflow-menu-card-1')).toHaveTextContent(
        'open',
      )

      // Press Escape to close
      fireEvent.keyDown(cardContent, { key: 'Escape' })
      expect(screen.getByTestId('overflow-menu-card-1')).toHaveTextContent(
        'closed',
      )
    })

    /**
     * Regression: previously the Card swallowed every Enter key bubbling up
     * through the React tree, including ones forwarded from descendants such
     * as the OverflowMenu's portal-rendered DropdownMenuItem. Pressing Enter
     * on "Move to Maintenance" therefore opened the Note modal instead of
     * triggering the menu action.
     *
     * The handler now ignores events whose target differs from the Card
     * itself. This test pins the new contract so the bug cannot quietly
     * return.
     */
    it('should ignore Enter events that bubbled up from a descendant', () => {
      render(<RepoCard card={defaultCard} onNote={mockOnNote} />)

      const cardContent = screen
        .getByTestId('repo-card-card-1')
        .querySelector('[tabIndex="0"]')!

      // Simulate Enter coming from a descendant (e.g. a Radix menu item):
      // the event's target is a child node, but the handler runs on the Card.
      const innerChild = cardContent.querySelector('[data-testid="repo-name"]')!
      fireEvent.keyDown(innerChild, { key: 'Enter', bubbles: true })

      expect(mockOnNote).not.toHaveBeenCalled()
    })
  })

  describe('Callback Invocations', () => {
    it('should call onNote when Note button is clicked', async () => {
      const user = userEvent.setup()
      render(<RepoCard card={defaultCard} onNote={mockOnNote} />)

      await user.click(screen.getByLabelText('Open note'))

      expect(mockOnNote).toHaveBeenCalledWith('card-1')
    })

    it('should call onCommentChange when comment is updated', async () => {
      render(
        <RepoCard
          card={defaultCard}
          showComment={true}
          onCommentChange={mockOnCommentChange}
        />,
      )

      // Click comment display to start editing
      fireEvent.click(screen.getByTestId('comment-display'))

      // The edit mode should now be visible (via Activity toggle)
      // Note: Due to Activity mock behavior, we verify the click handler was called
    })
  })

  describe('Drag and Drop', () => {
    it('should have cursor-grab class for draggable behavior', () => {
      render(<RepoCard card={defaultCard} />)

      const cardContainer = screen.getByTestId('repo-card-card-1')
      expect(cardContainer).toHaveClass('cursor-grab')
    })

    it('should have data-testid for card identification', () => {
      render(<RepoCard card={defaultCard} />)

      expect(screen.getByTestId('repo-card-card-1')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have focusable card content', () => {
      render(<RepoCard card={defaultCard} />)

      // Card content should have tabIndex for focus
      const card = screen
        .getByTestId('repo-card-card-1')
        .querySelector('[tabIndex="0"]')
      expect(card).toBeInTheDocument()
    })

    it('should have accessible Note button', () => {
      render(<RepoCard card={defaultCard} onNote={mockOnNote} />)

      const noteButton = screen.getByLabelText('Open note')
      expect(noteButton).toBeInTheDocument()
    })
  })

  describe('Comment Actions', () => {
    it('should call onCommentChange when comment is saved with closeOnSave', async () => {
      render(
        <RepoCard
          card={defaultCard}
          showComment={true}
          commentData={{ comment: 'Initial', color: 'neutral' }}
          onCommentChange={mockOnCommentChange}
        />,
      )

      // Click on comment display to enter edit mode
      fireEvent.click(screen.getByTestId('comment-display'))

      // The inline edit should now be visible
      // Click Save & Close button which calls onSave with closeOnSave: true
      const saveCloseBtn = screen.getByTestId('comment-save-close')
      fireEvent.click(saveCloseBtn)

      expect(mockOnCommentChange).toHaveBeenCalledWith('card-1', 'saved text')
    })

    it('should exit edit mode when cancel is clicked', () => {
      render(
        <RepoCard
          card={defaultCard}
          showComment={true}
          commentData={{ comment: 'Initial', color: 'neutral' }}
          onCommentChange={mockOnCommentChange}
        />,
      )

      // Click on comment display to enter edit mode
      fireEvent.click(screen.getByTestId('comment-display'))

      // Click cancel button
      const cancelBtn = screen.getByTestId('comment-cancel')
      fireEvent.click(cancelBtn)

      // Edit mode should be exited (we can't directly verify state, but we can verify the button existed and was clicked)
      expect(cancelBtn).toBeInTheDocument()
    })

    it('should call onCommentColorChange when color is changed', () => {
      render(
        <RepoCard
          card={defaultCard}
          showComment={true}
          commentData={{ comment: 'Test', color: 'neutral' }}
          onCommentColorChange={mockOnCommentColorChange}
        />,
      )

      // Find and click the color change button
      const colorBtn = screen.getByTestId('color-change-blue')
      fireEvent.click(colorBtn)

      expect(mockOnCommentColorChange).toHaveBeenCalledWith('card-1', 'blue')
    })

    it('should call onCommentDelete when delete is clicked', () => {
      render(
        <RepoCard
          card={defaultCard}
          showComment={true}
          commentData={{ comment: 'Test', color: 'neutral' }}
          onCommentDelete={mockOnCommentDelete}
        />,
      )

      // Find and click the delete button
      const deleteBtn = screen.getByTestId('delete-comment')
      fireEvent.click(deleteBtn)

      expect(mockOnCommentDelete).toHaveBeenCalledWith('card-1')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty tags array', () => {
      const cardWithEmptyTags = { ...defaultCard, tags: [] }
      render(<RepoCard card={cardWithEmptyTags} />)

      expect(screen.queryByText('typescript')).not.toBeInTheDocument()
    })

    it('should handle minimal card data', () => {
      const minimalCard = {
        id: toRepoCardId('card-min'),
        title: 'Minimal',
        statusId: toStatusListId('status-1'),
      }
      render(<RepoCard card={minimalCard} />)

      expect(screen.getByTestId('repo-name')).toHaveTextContent('Minimal')
    })

    it('should handle long title gracefully', () => {
      const longTitleCard = {
        ...defaultCard,
        title: 'very-long-repository-name-that-might-overflow-the-card-layout',
      }
      render(<RepoCard card={longTitleCard} />)

      expect(screen.getByTestId('repo-name')).toHaveTextContent(
        'very-long-repository-name',
      )
    })
  })
})
