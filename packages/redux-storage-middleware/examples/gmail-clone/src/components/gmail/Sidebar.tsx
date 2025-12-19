'use client'

/**
 * Gmail-style Sidebar Component
 *
 * Provides navigation between email labels with unread/starred counts.
 * Features a compose button and scrollable label list.
 */

import { memo, useCallback } from 'react'
import { Inbox, Star, Send, FileText, Trash2, Tag, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import {
  setCurrentLabel,
  selectEmailStats,
} from '@/lib/features/emails/emailSlice'
import { cn } from '@/lib/utils'

/** Navigation item configuration for sidebar labels */
interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  showBadge?: 'unread' | 'starred'
}

/** Primary navigation items displayed in the sidebar */
const NAV_ITEMS: NavItem[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, showBadge: 'unread' },
  { id: 'starred', label: 'Starred', icon: Star, showBadge: 'starred' },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'trash', label: 'Trash', icon: Trash2 },
]

/** Custom user-defined labels */
const CUSTOM_LABELS = ['Work', 'Personal', 'Promotions', 'Social', 'Updates']

function Sidebar() {
  const dispatch = useAppDispatch()
  const currentLabel = useAppSelector((state) => state.emails.currentLabel)
  const stats = useAppSelector(selectEmailStats)

  const handleLabelClick = useCallback(
    (labelId: string) => {
      dispatch(setCurrentLabel(labelId))
    },
    [dispatch],
  )

  const handleCompose = useCallback(() => {
    // Compose functionality to be implemented
    console.log('Compose clicked')
  }, [])

  return (
    <aside className="w-64 h-screen border-r bg-background flex flex-col fixed left-0 top-0">
      {/* Compose Button */}
      <div className="p-4">
        <Button
          onClick={handleCompose}
          className="w-full bg-red-600 hover:bg-red-700 text-white shadow-md"
          size="lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          Compose
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        {/* Primary Navigation */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentLabel === item.id
            const badgeCount =
              item.showBadge === 'unread'
                ? stats.unread
                : item.showBadge === 'starred'
                  ? stats.starred
                  : 0

            return (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(
                  'w-full justify-start h-10 px-3',
                  isActive && 'bg-accent font-semibold',
                )}
                onClick={() => handleLabelClick(item.id)}
              >
                <Icon className="mr-3 h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.showBadge && badgeCount > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {badgeCount}
                  </Badge>
                )}
              </Button>
            )
          })}
        </nav>

        <Separator className="my-4" />

        {/* Labels Section */}
        <div className="px-3 mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Labels
          </h3>
        </div>
        <nav className="space-y-1">
          {CUSTOM_LABELS.map((label) => {
            const labelId = label.toLowerCase()
            const isActive = currentLabel === labelId

            return (
              <Button
                key={labelId}
                variant="ghost"
                className={cn(
                  'w-full justify-start h-9 px-3',
                  isActive && 'bg-accent font-semibold',
                )}
                onClick={() => handleLabelClick(labelId)}
              >
                <Tag className="mr-3 h-4 w-4" />
                <span className="flex-1 text-left">{label}</span>
              </Button>
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}

export default memo(Sidebar)
