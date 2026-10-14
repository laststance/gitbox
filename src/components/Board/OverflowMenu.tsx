'use client'

import {
  MoreHorizontal,
  ExternalLink,
  BarChart2,
  Database,
  ArrowRightLeft,
  Trash2,
} from 'lucide-react'
import React, { memo, useState } from 'react'

import { GithubIcon } from '@/components/icons/GithubIcon'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCardDialogFocusReturn } from '@/hooks/board/useCardDialogFocusReturn'
import type { RepoCardId } from '@/lib/types/brands'

interface OverflowMenuProps {
  cardId: RepoCardId
  repoOwner?: string
  repoName?: string
  productionUrl?: string
  trackingUrl?: string
  supabaseUrl?: string
  onMoveToAnotherBoard?: (id: RepoCardId) => void
  /** Callback when repository is removed from board */
  onRemove?: (id: RepoCardId) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Overflow Menu Component
 *
 * A dropdown menu component for the actions of a repository card on a board.
 * - Open on GitHub
 * - Open Production URL
 * - Open Tracking dashboard
 * - Open Supabase dashboard
 * - Move to Another Board - Keeps the note, links and comment
 * - Remove from Board - Permanently deletes the card
 *
 * Note: "Edit Project Info" was consolidated into NoteModal (Issue #37)
 */
export const OverflowMenu = memo(function OverflowMenu({
  cardId,
  repoOwner,
  repoName,
  productionUrl,
  trackingUrl,
  supabaseUrl,
  onMoveToAnotherBoard,
  onRemove,
  open,
  onOpenChange,
}: OverflowMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { rememberCardSuccessor, handleCloseAutoFocus } =
    useCardDialogFocusReturn(cardId)

  const githubUrl =
    repoOwner && repoName ? `https://github.com/${repoOwner}/${repoName}` : null
  // What the menu button calls its card: owner/name, or the name alone
  const repoLabel =
    repoOwner && repoName ? `${repoOwner}/${repoName}` : repoName

  /**
   * Opens a URL in a new tab securely.
   * @param url - The URL to open
   */
  const handleOpenUrl = (url: string): void => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  /**
   * Handles the remove confirmation action.
   * Calls onRemove callback and closes the dialog.
   */
  const handleConfirmRemove = (): void => {
    // Before the card is gone: its neighbor takes the keyboard focus
    rememberCardSuccessor()
    onRemove?.(cardId)
    setShowDeleteDialog(false)
  }

  /**
   * Stop propagation of pointer / mouse / click / keyboard events so they
   * never reach an ancestor that listens for them (e.g. the `useSortable`
   * wrapper of `RepoCard`).
   *
   * Why this is here:
   * - Radix UI renders `DropdownMenuContent` and `AlertDialogContent` inside
   *   a Portal, but React hands synthetic events up through the React tree,
   *   not the DOM tree.
   * - When a menu item is pressed or clicked, the synthetic event bubbles
   *   back up through `OverflowMenu` to whatever ancestor mounted it.
   * - The drag sensors of the board do not take such an event for a press on
   *   the card: they ask {@link mayStartDrag} first, for a mouse, a finger
   *   and a key alike. This wrapper is a second guard for the mouse, the
   *   click and the keys. It does not stop a touch, and the `pointerdown` it
   *   stops is an event no sensor of the board listens for.
   * - Stopping propagation here lets Radix's own handlers run first (they
   *   are deeper in the React tree) and then short-circuits bubbling so the
   *   ancestor never sees the event.
   *
   * Before the sensors asked, this wrapper was the only guard: dnd-kit's
   * `MouseSensor` took the mousedown of a menu item, started a drag once the
   * cursor had moved more than `activationConstraint.distance`, and the drag
   * swallowed the click. "Move to Another Board" closed the menu and did
   * nothing.
   *
   * @param event - The event that reached the wrapper around the menu.
   * @example
   * <div className="contents" onMouseDown={stopPointerBubble}>
   *   <DropdownMenu>...</DropdownMenu>
   * </div>
   */
  const stopPointerBubble = (
    event: React.PointerEvent | React.MouseEvent | React.KeyboardEvent,
  ): void => {
    event.stopPropagation()
  }

  return (
    <div
      className="contents"
      onPointerDown={stopPointerBubble}
      onMouseDown={stopPointerBubble}
      onClick={stopPointerBubble}
      onKeyDown={stopPointerBubble}
      data-testid={`overflow-menu-isolation-${cardId}`}
    >
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger
          className="hover:bg-accent hover:text-accent-foreground focus:ring-ring rounded-md p-1 focus:ring-2 focus:ring-offset-2 focus:outline-none"
          data-testid={`overflow-menu-trigger-${cardId}`}
        >
          <MoreHorizontal className="h-4 w-4" />
          {/* Named after the repository and its owner: a board has one such
              button per card, and two owners can each have a repository of
              the same name */}
          <span className="sr-only">
            {repoLabel ? `Open menu for ${repoLabel}` : 'Open menu'}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          data-testid="overflow-menu"
        >
          {/* Open on GitHub */}
          {githubUrl && (
            <DropdownMenuItem
              onClick={() => handleOpenUrl(githubUrl)}
              data-testid={`open-github-${cardId}`}
            >
              <GithubIcon className="mr-2 h-4 w-4" />
              Open on GitHub
            </DropdownMenuItem>
          )}

          {/* Open Production URL */}
          {productionUrl && (
            <DropdownMenuItem
              onClick={() => handleOpenUrl(productionUrl)}
              data-testid={`open-production-${cardId}`}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Production URL
            </DropdownMenuItem>
          )}

          {/* Open Tracking dashboard */}
          {trackingUrl && (
            <DropdownMenuItem
              onClick={() => handleOpenUrl(trackingUrl)}
              data-testid={`open-tracking-${cardId}`}
            >
              <BarChart2 className="mr-2 h-4 w-4" />
              Open Tracking dashboard
            </DropdownMenuItem>
          )}

          {/* Open Supabase dashboard */}
          {supabaseUrl && (
            <DropdownMenuItem
              onClick={() => handleOpenUrl(supabaseUrl)}
              data-testid={`open-supabase-${cardId}`}
            >
              <Database className="mr-2 h-4 w-4" />
              Open Supabase dashboard
            </DropdownMenuItem>
          )}

          {/* Separator before actions */}
          {(githubUrl || productionUrl || trackingUrl || supabaseUrl) &&
            (onMoveToAnotherBoard || onRemove) && <DropdownMenuSeparator />}

          {/* Move to Another Board */}
          {onMoveToAnotherBoard && (
            <DropdownMenuItem
              onClick={() => onMoveToAnotherBoard(cardId)}
              data-testid={`move-to-another-board-${cardId}`}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Move to Another Board
            </DropdownMenuItem>
          )}

          {/* Remove from Board - Destructive action */}
          {onRemove && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                data-testid={`remove-from-board-${cardId}`}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove from Board
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onCloseAutoFocus={handleCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Repository from Board?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{' '}
              <span className="text-foreground font-semibold">
                {repoOwner}/{repoName}
              </span>{' '}
              from this board and permanently deletes its note, links and
              comment. Adding the repository again will not restore them. To
              keep them, use Move to Another Board instead. The repository on
              GitHub is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              // The token, not text-white: white is below AA contrast on the
              // destructive fill of the dark themes
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              data-testid={`confirm-remove-${cardId}`}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
})
