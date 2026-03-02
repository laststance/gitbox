import { useReducedMotion, m } from 'framer-motion'
import React, { memo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Kanban Board Component
 *
 * The main Kanban board displaying status columns and repository cards.
 * - Drag-and-drop card reordering via @dnd-kit (useKanbanDnD)
 * - Undo functionality with Z key shortcut (useKanbanUndo)
 * - Comment CRUD with optimistic updates (useCommentState)
 * - Redux state management with localStorage sync
 */
// Loading Skeleton Component
export const KanbanSkeleton = memo(() => {
  const prefersReducedMotion = useReducedMotion()
  return (
    <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {[...Array(5)].map((_, colIndex) => (
        <div
          key={colIndex}
          className="bg-background/50 border-border rounded-xl border p-4 backdrop-blur-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-12" />
          </div>
          <div className="space-y-3">
            {[...Array(2)].map((_, cardIndex) => (
              <m.div
                key={cardIndex}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: prefersReducedMotion ? 0 : cardIndex * 0.1,
                  duration: prefersReducedMotion ? 0 : undefined,
                }}
              >
                <Skeleton className="h-32 w-full rounded-lg" />
              </m.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
})
KanbanSkeleton.displayName = 'KanbanSkeleton'
