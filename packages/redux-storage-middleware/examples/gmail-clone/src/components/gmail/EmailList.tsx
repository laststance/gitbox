'use client'

/**
 * Gmail-style Email List Component
 *
 * Displays a scrollable list of emails with toolbar actions and interactive features.
 * Supports bulk selection, starring, and read/unread status management.
 */

import { format, isToday, isThisYear } from 'date-fns'
import { Paperclip, Star, Trash2, Mail, MailOpen } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import type { Email } from '@/lib/features/emails/emailSlice'
import {
  selectFilteredEmails,
  selectEmail,
  toggleStar,
  markAsRead,
  deleteEmail,
  markAllAsRead,
} from '@/lib/features/emails/emailSlice'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { cn } from '@/lib/utils'

/**
 * Format email timestamp for display
 * @param timestamp - ISO timestamp string
 * @returns
 * - Today: "3:45 PM"
 * - This year: "Dec 15"
 * - Older: "Dec 15, 2023"
 * @example
 * formatTimestamp('2024-12-19T15:45:00Z') // => "3:45 PM" (if today)
 * formatTimestamp('2024-12-15T10:00:00Z') // => "Dec 15" (if this year)
 * formatTimestamp('2023-12-15T10:00:00Z') // => "Dec 15, 2023"
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)

  if (isToday(date)) {
    return format(date, 'h:mm a')
  }

  if (isThisYear(date)) {
    return format(date, 'MMM d')
  }

  return format(date, 'MMM d, yyyy')
}

/**
 * Extract sender display name from email address
 * @param email - Full email address
 * @returns Display name or email prefix
 * @example
 * getSenderName('John Doe <john@example.com>') // => "John Doe"
 * getSenderName('john.doe@example.com') // => "john.doe"
 */
function getSenderName(email: string): string {
  const match = email.match(/^(.+?)\s*<.+>$/)
  if (match) {
    return match[1]
  }
  return email.split('@')[0]
}

/**
 * Get first letter of sender name for avatar
 * @param email - Full email address
 * @returns Uppercase first letter
 * @example
 * getSenderInitial('john.doe@example.com') // => "J"
 */
function getSenderInitial(email: string): string {
  const name = getSenderName(email)
  return name.charAt(0).toUpperCase()
}

/** Number of skeleton rows to display during loading */
const SKELETON_COUNT = 8

/**
 * Loading skeleton for email list
 */
function EmailListSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  )
}

/**
 * Single email row component
 */
interface EmailRowProps {
  email: Email
  isSelected: boolean
  isChecked: boolean
  onSelect: (id: string) => void
  onToggleCheck: (id: string) => void
  onToggleStar: (id: string, event: React.MouseEvent) => void
}

const EmailRow = memo(function EmailRow({
  email,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
  onToggleStar,
}: EmailRowProps) {
  const senderName = getSenderName(email.from)
  const senderInitial = getSenderInitial(email.from)

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 cursor-pointer hover:shadow-sm transition-colors',
        isSelected && 'bg-blue-50',
        !email.read && 'bg-white',
        email.read && !isSelected && 'bg-gray-50/50',
      )}
      onClick={() => onSelect(email.id)}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isChecked}
        onClick={(e) => e.stopPropagation()}
        onCheckedChange={() => onToggleCheck(email.id)}
        className="shrink-0"
      />

      {/* Star button */}
      <button
        onClick={(e) => onToggleStar(email.id, e)}
        className="shrink-0 hover:scale-110 transition-transform"
      >
        <Star
          className={cn(
            'h-4 w-4',
            email.starred
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-gray-400 hover:text-yellow-400',
          )}
        />
      </button>

      {/* Sender avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-blue-500 text-white text-sm">
          {senderInitial}
        </AvatarFallback>
      </Avatar>

      {/* Email content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm truncate',
              !email.read && 'font-semibold text-gray-900',
              email.read && 'text-gray-600',
            )}
          >
            {senderName}
          </span>
          {email.labels.length > 0 && email.labels[0] !== 'inbox' && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {email.labels[0]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-sm truncate',
              !email.read && 'font-semibold text-gray-900',
              email.read && 'text-gray-600',
            )}
          >
            {email.subject}
          </span>
          <span className="text-gray-400 mx-1">-</span>
          <span className="text-sm text-gray-500 truncate">
            {email.preview}
          </span>
        </div>
      </div>

      {/* Attachment and timestamp */}
      <div className="flex items-center gap-2 shrink-0">
        {email.hasAttachment && <Paperclip className="h-4 w-4 text-gray-400" />}
        <span
          className={cn(
            'text-xs whitespace-nowrap',
            !email.read && 'font-semibold text-gray-900',
            email.read && 'text-gray-500',
          )}
        >
          {formatTimestamp(email.timestamp)}
        </span>
      </div>
    </div>
  )
})

/**
 * Gmail-style Email List Component
 *
 * Features:
 * - Bulk actions toolbar (Select all, Mark as read, Delete)
 * - Scrollable email list with virtualization-ready structure
 * - Email selection with highlight
 * - Star toggle
 * - Read/unread visual distinction
 * - Loading skeleton state
 */
function EmailList() {
  const dispatch = useAppDispatch()
  const emails = useAppSelector(selectFilteredEmails)
  const selectedId = useAppSelector((state) => state.emails.selectedId)
  const isLoading = useAppSelector((state) => state.emails.isLoading)

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const handleSelectEmail = useCallback(
    (id: string) => {
      dispatch(selectEmail(id))
    },
    [dispatch],
  )

  const handleToggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleToggleStar = useCallback(
    (id: string, event: React.MouseEvent) => {
      event.stopPropagation()
      dispatch(toggleStar(id))
    },
    [dispatch],
  )

  const handleSelectAll = useCallback(() => {
    if (checkedIds.size === emails.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(emails.map((e) => e.id)))
    }
  }, [emails, checkedIds.size])

  const handleMarkAsRead = useCallback(() => {
    if (checkedIds.size > 0) {
      checkedIds.forEach((id) => {
        dispatch(markAsRead({ id, read: true }))
      })
      setCheckedIds(new Set())
    } else {
      dispatch(markAllAsRead())
    }
  }, [dispatch, checkedIds])

  const handleDelete = useCallback(() => {
    checkedIds.forEach((id) => {
      dispatch(deleteEmail(id))
    })
    setCheckedIds(new Set())
  }, [dispatch, checkedIds])

  const allSelected = emails.length > 0 && checkedIds.size === emails.length
  const someSelected = checkedIds.size > 0

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="border-b px-4 py-2 flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <EmailListSkeleton />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="border-b px-4 py-2 flex items-center gap-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={handleSelectAll}
          className="mr-2"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMarkAsRead}
          disabled={emails.length === 0}
          className="gap-1"
        >
          {someSelected ? (
            <MailOpen className="h-4 w-4" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Mark as read</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={!someSelected}
          className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Delete</span>
        </Button>
        {someSelected && (
          <span className="text-sm text-gray-500 ml-auto">
            {checkedIds.size} selected
          </span>
        )}
      </div>

      {/* Email list */}
      <ScrollArea className="flex-1">
        {emails.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-500">
            No emails found
          </div>
        ) : (
          <div className="divide-y">
            {emails.map((email) => (
              <EmailRow
                key={email.id}
                email={email}
                isSelected={email.id === selectedId}
                isChecked={checkedIds.has(email.id)}
                onSelect={handleSelectEmail}
                onToggleCheck={handleToggleCheck}
                onToggleStar={handleToggleStar}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

export default memo(EmailList)
