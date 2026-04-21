'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Paperclip, StickyNote } from 'lucide-react'
import React, { memo, useCallback, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { CommentData } from '@/lib/actions/project-info'
import type { CommentColor } from '@/lib/supabase/types'
import type { CommentTextSettings } from '@/lib/types/board-settings'
import type { RepoCardId, StatusListId } from '@/lib/types/brands'
import type { Priority } from '@/lib/types/domain-primitives'

import { type CommentSaveOptions } from './CommentInlineEdit'
import { CommentSection } from './CommentSection'
import { OverflowMenu } from './OverflowMenu'

interface RepoCardData {
  id: RepoCardId
  title: string
  description?: string
  priority?: Priority
  assignee?: {
    name: string
    avatar: string
  }
  tags?: string[]
  dueDate?: string
  attachments?: number
  /** @deprecated Use comment prop instead */
  comments?: number
  statusId: StatusListId
  /** GitHub repository owner */
  repoOwner?: string
  /** GitHub repository name */
  repoName?: string
}

interface RepoCardProps {
  card: RepoCardData
  /** Comment data (text + border color) from projectinfo */
  commentData?: CommentData
  /** Text style settings for comment display (font size/weight from board settings) */
  commentText?: CommentTextSettings
  /** Whether to show the comment section */
  showComment?: boolean
  onMaintenance?: (id: RepoCardId) => void
  /** Callback when card is moved to another board */
  onMoveToBoard?: (id: RepoCardId) => void
  /** Callback when Note button is clicked (opens unified NoteModal with notes + links) */
  onNote?: (id: RepoCardId) => void
  /** Callback when repository is removed from board */
  onRemove?: (id: RepoCardId) => void
  /** Callback when comment area is clicked (for editing) - deprecated, editing is now built-in */
  onCommentClick?: (id: RepoCardId) => void
  /** Callback when comment is updated (for optimistic updates in parent) */
  onCommentChange?: (id: RepoCardId, newComment: string) => void
  /** Callback when comment color is changed */
  onCommentColorChange?: (id: RepoCardId, color: CommentColor) => void
  /** Callback when comment is deleted */
  onCommentDelete?: (id: RepoCardId) => void
}

/**
 * Repository Card Component
 *
 * A draggable card representing a GitHub repository in the Kanban board.
 * - Displays repository info (title, description, tags, assignee, metadata)
 * - Drag-and-drop support via @dnd-kit/sortable
 * - Keyboard navigation for accessibility
 * - Overflow menu for card actions
 */
export const RepoCard = memo<RepoCardProps>(
  ({
    card,
    commentData,
    commentText,
    showComment = true,
    onMaintenance,
    onMoveToBoard,
    onNote,
    onRemove,
    onCommentClick,
    onCommentChange,
    onCommentColorChange,
    onCommentDelete,
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: card.id })

    const [menuOpen, setMenuOpen] = useState(false)
    const [isEditingComment, setIsEditingComment] = useState(false)

    /**
     * Handle menu open state changes from OverflowMenu dropdown.
     * Wraps setState to comply with no-set-state-prop-drilling rule.
     *
     * @param open - Whether the menu should be open
     */
    const handleMenuOpenChange = (open: boolean) => {
      setMenuOpen(open)
    }

    /**
     * Handle click on comment area to start editing
     */
    const handleCommentClick = useCallback(() => {
      setIsEditingComment(true)
      onCommentClick?.(card.id)
    }, [card.id, onCommentClick])

    /**
     * Handle saving the comment
     *
     * @param newComment - The new comment value
     * @param options - Save options including whether to close edit mode
     */
    const handleCommentSave = useCallback(
      async (newComment: string, options: CommentSaveOptions) => {
        // Optimistic update - notify parent immediately
        onCommentChange?.(card.id, newComment)
        // Only close edit mode if explicitly requested (manual save)
        // Auto-save keeps edit mode open so user can continue typing
        if (options.closeOnSave) {
          setIsEditingComment(false)
        }
      },
      [card.id, onCommentChange],
    )

    /**
     * Handle cancelling comment edit
     */
    const handleCommentCancel = useCallback(() => {
      setIsEditingComment(false)
    }, [])

    /**
     * Handle color change from CommentActionsMenu
     */
    const handleColorChange = useCallback(
      (color: CommentColor) => {
        onCommentColorChange?.(card.id, color)
      },
      [card.id, onCommentColorChange],
    )

    /**
     * Handle delete from CommentActionsMenu (clears comment text only)
     */
    const handleCommentDelete = useCallback(() => {
      onCommentDelete?.(card.id)
    }, [card.id, onCommentDelete])

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    /**
     * Keyboard navigation handler
     * Requirements: Full keyboard navigation support
     *
     * @param e - KeyboardEvent
     */
    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Enter: Open NoteModal (unified notes + links)
      if (e.key === 'Enter' && onNote) {
        e.preventDefault()
        onNote(card.id)
      }

      // . (period): Toggle overflow menu
      if (e.key === '.' || e.key === 'Period') {
        e.preventDefault()
        setMenuOpen((prev) => !prev)
      }

      // Escape: Close overflow menu
      if (e.key === 'Escape' && menuOpen) {
        e.preventDefault()
        setMenuOpen(false)
      }
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        data-testid={`repo-card-${card.id}`}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <Card
          className="bg-card focus-within:ring-ring border transition-all duration-200 focus-within:ring-2 focus-within:ring-offset-2 hover:shadow-md dark:hover:shadow-lg"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <h4
                  className="text-foreground flex-1 leading-tight font-semibold"
                  data-testid="repo-name"
                >
                  {card.title}
                </h4>
                <OverflowMenu
                  cardId={card.id}
                  repoOwner={card.repoOwner}
                  repoName={card.repoName}
                  onMoveToMaintenance={onMaintenance}
                  onMoveToAnotherBoard={
                    onMoveToBoard ? () => onMoveToBoard(card.id) : undefined
                  }
                  onRemove={onRemove}
                  open={menuOpen}
                  onOpenChange={handleMenuOpenChange}
                  context="board"
                />
              </div>

              {card.description && (
                <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                  {card.description}
                </p>
              )}

              {card.tags && card.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Inline Comment (Card-in-Card style) */}
              {showComment && (
                <CommentSection
                  comment={commentData?.comment}
                  color={commentData?.color}
                  isEditing={isEditingComment}
                  onStartEdit={handleCommentClick}
                  onSave={handleCommentSave}
                  onCancel={handleCommentCancel}
                  onColorChange={handleColorChange}
                  onDelete={handleCommentDelete}
                  style={commentText}
                />
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="text-muted-foreground flex items-center gap-3">
                  {card.dueDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        {new Date(card.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  {card.attachments && (
                    <div className="flex items-center gap-1">
                      <Paperclip className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        {card.attachments}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onNote?.(card.id)}
                    className="hover:text-foreground flex items-center gap-1 transition-colors"
                    aria-label="Open note"
                  >
                    <StickyNote className="h-4 w-4" />
                    <span className="text-sm font-medium">Note</span>
                  </button>
                </div>

                {card.assignee && (
                  <Avatar className="ring-background h-7 w-7 ring-2">
                    <AvatarImage src={card.assignee.avatar} />
                    <AvatarFallback
                      className="text-xs"
                      data-testid="repo-owner"
                    >
                      {card.assignee.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
)

RepoCard.displayName = 'RepoCard'
