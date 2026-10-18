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
  /** Callback when card is moved to another board */
  onMoveToBoard?: (id: RepoCardId) => void
  /** Callback when Note button is clicked (opens unified NoteModal with notes + links) */
  onNote?: (id: RepoCardId) => void
  /** Read this card's repository from GitHub and rewrite its snapshot. */
  onRefresh?: (id: RepoCardId) => void
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
/** What {@link useSortable} gives a card. Absent until the page has mounted. */
type CardDrag = ReturnType<typeof useSortable>

/**
 * The card as it looks, with drag behavior only when `sortable` is passed.
 *
 * The drag id is a process-wide counter inside dnd-kit. Rendering it on the
 * server makes the next request's id differ from the browser's, and hydration
 * throws the board away. {@link RestingRepoCard} leaves it out. Called by
 * {@link RepoCard} once the page has mounted.
 */
const RepoCardView = memo(function RepoCardView({
  card,
  commentData,
  commentText,
  showComment = true,
  onMoveToBoard,
  onNote,
  onRefresh,
  onRemove,
  onCommentClick,
  onCommentChange,
  onCommentColorChange,
  onCommentDelete,
  sortable,
}: RepoCardProps & { sortable?: CardDrag }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isEditingComment, setIsEditingComment] = useState(false)

  /**
   * Handle menu open state changes from OverflowMenu dropdown.
   * Wraps setState to comply with no-set-state-prop-drilling rule.
   *
   * @param open - Whether the menu should be open
   */
  const handleMenuOpenChange = (open: boolean): void => {
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

  const style: React.CSSProperties | undefined = sortable
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.5 : 1,
      }
    : undefined

  /**
   * Keyboard navigation handler
   * Requirements: Full keyboard navigation support
   *
   * Defensive guard: only react to keys that originated on the Card itself.
   * Without this, keystrokes from descendants rendered via Portal (e.g. the
   * `OverflowMenu` `DropdownMenuItem`s) would bubble through the React tree
   * and accidentally open the Note modal when the user pressed Enter on a
   * focused menu item.
   *
   * @param e - KeyboardEvent
   */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // Ignore events forwarded from a portal child (menu item, dialog, etc.)
    // so the card's shortcuts never fire while a child has focus.
    if (e.target !== e.currentTarget) return

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
      ref={sortable?.setNodeRef}
      style={style}
      data-testid={`repo-card-${card.id}`}
      {...sortable?.attributes}
      {...sortable?.listeners}
      // dnd-kit puts this handle in the tab order (tabIndex 0, role button).
      // The card inside is already a stop: Enter opens the note, "." opens
      // the menu, and the focus ring is drawn there. A second stop made Tab
      // land twice on every card. Space still lifts the card, because that
      // key bubbles from the card to these listeners.
      tabIndex={sortable ? -1 : undefined}
      className={sortable ? 'cursor-grab active:cursor-grabbing' : undefined}
    >
      <Card
        className="bg-card focus-within:ring-ring border transition-shadow duration-200 focus-within:ring-2 focus-within:ring-offset-2 hover:shadow-md dark:hover:shadow-lg"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        // Read by card-focus-target.ts: where the focus goes around this card
        data-repo-card-id={card.id}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              {/* wrap-anywhere: a repository name without a hyphen
                    (snake_case) has no place to break. The title could not
                    get narrower than that one piece and pushed the menu
                    button out of the card, where the mouse does not reach
                    it. Now the piece breaks where the line ends. */}
              <h3
                className="text-foreground flex-1 leading-tight font-semibold wrap-anywhere"
                data-testid="repo-name"
              >
                {card.title}
              </h3>
              <OverflowMenu
                cardId={card.id}
                repoOwner={card.repoOwner}
                repoName={card.repoName}
                onMoveToAnotherBoard={
                  onMoveToBoard ? (): void => onMoveToBoard(card.id) : undefined
                }
                onRefresh={onRefresh}
                onRemove={onRemove}
                open={menuOpen}
                onOpenChange={handleMenuOpenChange}
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
                  <AvatarFallback className="text-xs" data-testid="repo-owner">
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
})

RepoCardView.displayName = 'RepoCardView'

/**
 * A repository card that can be dragged.
 *
 * Exists so the mounted board can move cards. Called by {@link StatusColumn}
 * after the page has mounted. Before that, {@link RestingRepoCard} is shown:
 * dnd-kit's description id would not match the server's.
 */
export const RepoCard = memo(function RepoCard(props: RepoCardProps) {
  const sortable = useSortable({ id: props.card.id })
  return <RepoCardView {...props} sortable={sortable} />
})

RepoCard.displayName = 'RepoCard'

/**
 * The same card, before drag-and-drop is attached.
 *
 * Shown by {@link StatusColumn} on the server and the first client render.
 * The title, the comment and the menu are already there. Dragging starts
 * once {@link RepoCard} takes its place.
 */
export const RestingRepoCard = memo(function RestingRepoCard(
  props: RepoCardProps,
) {
  return <RepoCardView {...props} />
})

RestingRepoCard.displayName = 'RestingRepoCard'
