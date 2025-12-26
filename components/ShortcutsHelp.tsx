'use client'

import {
  Keyboard,
  Command,
  CornerDownLeft,
  RotateCcw,
  HelpCircle,
  MoreHorizontal,
} from 'lucide-react'
import React, { useEffect, useState, memo } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OPEN_SHORTCUTS_HELP } from '@/lib/events'

interface ShortcutItem {
  key: string
  description: string
  icon: React.ReactNode
  category: string
}

interface ShortcutsHelpProps {
  defaultOpen?: boolean
}

/**
 * Shortcuts Help Component
 *
 * A modal dialog displaying keyboard shortcuts help.
 * - Accessible via ? key
 * - Categorized shortcuts (Navigation, Actions, Help)
 * - ESC key to close
 * - WCAG AA accessibility compliance
 * - Accessible table format
 */
export const ShortcutsHelp = memo(function ShortcutsHelp({
  defaultOpen = false,
}: ShortcutsHelpProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  /**
   * Handle dialog open state changes.
   * Wraps setState to comply with no-set-state-prop-drilling rule.
   *
   * @param open - Whether the dialog should be open
   */
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
  }

  /**
   * Keyboard shortcuts definition
   * English text for UI display
   */
  const shortcuts: ShortcutItem[] = [
    {
      key: 'Tab',
      description: 'Navigate between cards',
      icon: <Keyboard className="w-4 h-4" />,
      category: 'Navigation',
    },
    {
      key: '.',
      description: 'Open overflow menu',
      icon: <MoreHorizontal className="w-4 h-4" />,
      category: 'Navigation',
    },
    {
      key: 'Enter',
      description: 'Open card',
      icon: <CornerDownLeft className="w-4 h-4" />,
      category: 'Actions',
    },
    {
      key: 'Z',
      description: 'Undo last operation',
      icon: <RotateCcw className="w-4 h-4" />,
      category: 'Actions',
    },
    {
      key: '?',
      description: 'Show/hide this help',
      icon: <HelpCircle className="w-4 h-4" />,
      category: 'Help',
    },
    {
      key: '⌘K',
      description: 'Open command palette',
      icon: <Command className="w-4 h-4" />,
      category: 'Navigation',
    },
  ]

  /**
   * Group shortcuts by category
   */
  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = []
      }
      acc[shortcut.category].push(shortcut)
      return acc
    },
    {} as Record<string, ShortcutItem[]>,
  )

  /**
   * Keyboard event handler
   * Requirements: ? key to show help, ESC key to close
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ? key to toggle (disabled in input/textarea)
      if (
        event.key === '?' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const target = event.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          event.preventDefault()
          setIsOpen((prev) => !prev)
        }
      }

      // ESC key to close
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  /**
   * Custom event listener for opening modal from Sidebar
   * Allows Shortcuts link in Sidebar to trigger this modal
   */
  useEffect(() => {
    const handleOpenShortcuts = () => {
      setIsOpen(true)
    }

    window.addEventListener(OPEN_SHORTCUTS_HELP, handleOpenShortcuts)
    return () =>
      window.removeEventListener(OPEN_SHORTCUTS_HELP, handleOpenShortcuts)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-2xl"
        data-testid="shortcuts-help-modal"
        aria-describedby="keyboard-shortcuts-description"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Keyboard className="w-6 h-6" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription id="keyboard-shortcuts-description">
            List of keyboard shortcuts for the GitHub Repository management app
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                {category}
              </h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Icon</th>
                      <th scope="col">Shortcut Key</th>
                      <th scope="col">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((shortcut, index) => (
                      <tr
                        key={`${category}-${index}`}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 w-12">
                          <div className="text-muted-foreground flex items-center justify-center">
                            {shortcut.icon}
                          </div>
                        </td>
                        <td className="px-4 py-3 w-32">
                          <kbd className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-semibold bg-muted border border-border rounded-md shadow-sm min-w-[3rem]">
                            {shortcut.key}
                          </kbd>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {shortcut.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">
              ?
            </kbd>{' '}
            or{' '}
            <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">
              ESC
            </kbd>{' '}
            to close this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
})

export default ShortcutsHelp
