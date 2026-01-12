'use client'

import {
  MoreHorizontal,
  Github,
  ExternalLink,
  BarChart2,
  Database,
  Edit,
  Archive,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import React, { memo, useState } from 'react'

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

interface OverflowMenuProps {
  cardId: string
  repoOwner?: string
  repoName?: string
  productionUrl?: string
  trackingUrl?: string
  supabaseUrl?: string
  onEdit?: (id: string) => void
  onMoveToMaintenance?: (id: string) => void
  onRestoreToBoard?: (id: string) => void
  /** Callback when repository is removed from board */
  onRemove?: (id: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Board or Maintenance context */
  context?: 'board' | 'maintenance'
}

/**
 * Overflow Menu Component
 *
 * A dropdown menu component for repository card actions.
 * Provides context-specific actions for Board and Maintenance modes.
 * - Open on GitHub
 * - Open Production URL
 * - Open Tracking dashboard
 * - Open Supabase dashboard
 * - Edit Project Info
 * - Move to Maintenance (Board only)
 * - Remove from Board (Board only) - Permanently deletes the card
 * - Restore to Board (Maintenance only)
 */
export const OverflowMenu = memo<OverflowMenuProps>(
  ({
    cardId,
    repoOwner,
    repoName,
    productionUrl,
    trackingUrl,
    supabaseUrl,
    onEdit,
    onMoveToMaintenance,
    onRestoreToBoard,
    onRemove,
    open,
    onOpenChange,
    context = 'board',
  }) => {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    const githubUrl =
      repoOwner && repoName
        ? `https://github.com/${repoOwner}/${repoName}`
        : null

    /**
     * Opens a URL in a new tab securely.
     * @param url - The URL to open
     */
    const handleOpenUrl = (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer')
    }

    /**
     * Handles the remove confirmation action.
     * Calls onRemove callback and closes the dialog.
     */
    const handleConfirmRemove = () => {
      onRemove?.(cardId)
      setShowDeleteDialog(false)
    }

    return (
      <>
        <DropdownMenu open={open} onOpenChange={onOpenChange}>
          <DropdownMenuTrigger
            className="p-1 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            data-testid={`overflow-menu-trigger-${cardId}`}
          >
            <MoreHorizontal className="w-4 h-4" />
            <span className="sr-only">Open menu</span>
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
                <Github className="w-4 h-4 mr-2" />
                Open on GitHub
              </DropdownMenuItem>
            )}

            {/* Open Production URL */}
            {productionUrl && (
              <DropdownMenuItem
                onClick={() => handleOpenUrl(productionUrl)}
                data-testid={`open-production-${cardId}`}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Production URL
              </DropdownMenuItem>
            )}

            {/* Open Tracking dashboard */}
            {trackingUrl && (
              <DropdownMenuItem
                onClick={() => handleOpenUrl(trackingUrl)}
                data-testid={`open-tracking-${cardId}`}
              >
                <BarChart2 className="w-4 h-4 mr-2" />
                Open Tracking dashboard
              </DropdownMenuItem>
            )}

            {/* Open Supabase dashboard */}
            {supabaseUrl && (
              <DropdownMenuItem
                onClick={() => handleOpenUrl(supabaseUrl)}
                data-testid={`open-supabase-${cardId}`}
              >
                <Database className="w-4 h-4 mr-2" />
                Open Supabase dashboard
              </DropdownMenuItem>
            )}

            {/* Separator before actions */}
            {(githubUrl || productionUrl || trackingUrl || supabaseUrl) &&
              (onEdit ||
                onMoveToMaintenance ||
                onRestoreToBoard ||
                onRemove) && <DropdownMenuSeparator />}

            {/* Edit Project Info */}
            {onEdit && (
              <DropdownMenuItem
                onClick={() => onEdit(cardId)}
                data-testid={`edit-project-${cardId}`}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Project Info…
              </DropdownMenuItem>
            )}

            {/* Move to Maintenance (Board context only) */}
            {context === 'board' && onMoveToMaintenance && (
              <DropdownMenuItem
                onClick={() => onMoveToMaintenance(cardId)}
                data-testid={`move-to-maintenance-${cardId}`}
              >
                <Archive className="w-4 h-4 mr-2" />
                Move to Maintenance
              </DropdownMenuItem>
            )}

            {/* Remove from Board (Board context only) - Destructive action */}
            {context === 'board' && onRemove && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  data-testid={`remove-from-board-${cardId}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove from Board
                </DropdownMenuItem>
              </>
            )}

            {/* Restore to Board (Maintenance context only) */}
            {context === 'maintenance' && onRestoreToBoard && (
              <DropdownMenuItem
                onClick={() => onRestoreToBoard(cardId)}
                data-testid={`restore-to-board-${cardId}`}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore to Board
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Remove Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Repository from Board?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove{' '}
                <span className="font-semibold text-foreground">
                  {repoOwner}/{repoName}
                </span>{' '}
                from this board. The repository itself will not be deleted from
                GitHub. You can always add it back later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmRemove}
                className="bg-destructive text-white hover:bg-destructive/90"
                data-testid={`confirm-remove-${cardId}`}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  },
)

OverflowMenu.displayName = 'OverflowMenu'
