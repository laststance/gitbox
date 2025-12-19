'use client'

import { memo } from 'react'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Star,
  Trash2,
  MoreVertical,
  Reply,
  Forward,
  Archive,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { useAppSelector, useAppDispatch } from '@/lib/hooks'
import {
  selectSelectedEmail,
  selectEmail,
  toggleStar,
  deleteEmail,
} from '@/lib/features/emails/emailSlice'

/**
 * EmailViewer component displays the full content of a selected email.
 *
 * Features:
 * - Header with navigation (back button) and action icons (star, delete, archive)
 * - Sender information with avatar and email metadata
 * - Labels displayed as badges
 * - Full email body with preserved formatting
 * - Reply and Forward action buttons
 * - Placeholder state when no email is selected
 *
 * @returns The email viewer panel or a placeholder message
 */
function EmailViewer() {
  const dispatch = useAppDispatch()
  const selectedEmail = useAppSelector(selectSelectedEmail)

  /**
   * Navigate back to the email list by deselecting the current email.
   */
  const handleBack = () => {
    dispatch(selectEmail(null))
  }

  /**
   * Toggle the starred status of the current email.
   */
  const handleToggleStar = () => {
    if (selectedEmail) {
      dispatch(toggleStar(selectedEmail.id))
    }
  }

  /**
   * Delete the current email and navigate back to the list.
   */
  const handleDelete = () => {
    if (selectedEmail) {
      dispatch(deleteEmail(selectedEmail.id))
    }
  }

  /**
   * Extract initials from an email address for the avatar fallback.
   *
   * @param email - The sender's email address
   * @returns The first two characters of the email username in uppercase
   * @example
   * getInitials('john.doe@example.com') // => 'JO'
   */
  const getInitials = (email: string): string => {
    const name = email.split('@')[0]
    return name.slice(0, 2).toUpperCase()
  }

  // Show placeholder when no email is selected
  if (!selectedEmail) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No email selected</p>
          <p className="text-sm">
            Select an email from the list to view its content
          </p>
        </div>
      </div>
    )
  }

  const formattedDate = format(new Date(selectedEmail.timestamp), 'PPpp')

  return (
    <div className="flex h-full w-full flex-col overflow-auto">
      {/* Header with back button and actions */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{selectedEmail.subject}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleStar}
            aria-label={selectedEmail.starred ? 'Unstar email' : 'Star email'}
          >
            <Star
              className={`h-5 w-5 ${
                selectedEmail.starred
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              }`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            aria-label="Delete email"
          >
            <Trash2 className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Archive email">
            <Archive className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="More options">
            <MoreVertical className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Sender metadata */}
        <Card className="mb-6 p-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(selectedEmail.from)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selectedEmail.from}</p>
                  <p className="text-sm text-muted-foreground">
                    To: {selectedEmail.to}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">{formattedDate}</p>
              </div>
              {/* Labels */}
              {selectedEmail.labels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedEmail.labels.map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Separator className="my-4" />

        {/* Email body */}
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {selectedEmail.body}
        </div>
      </div>

      {/* Action buttons */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Reply className="h-4 w-4" />
            Reply
          </Button>
          <Button variant="outline" className="gap-2">
            <Forward className="h-4 w-4" />
            Forward
          </Button>
        </div>
      </div>
    </div>
  )
}

export default memo(EmailViewer)
