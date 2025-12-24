'use client'

import { useDroppable } from '@dnd-kit/core'
import { memo } from 'react'

import { cn } from '@/lib/utils'

/**
 * Drop zone type identifier
 * Used to distinguish new row drops from column swaps in DndContext
 */
export const NEW_ROW_DROP_TYPE = 'new-row'

interface NewRowDropZoneProps {
  /** Target row index for the new row */
  targetRow: number
  /** Number of columns in the grid (for spanning) */
  columnCount: number
}

/**
 * New Row Drop Zone Component
 *
 * A droppable area at the bottom of the grid that allows users
 * to move columns to a new row. When a column is dropped here,
 * it will be placed in a new row at the first column position.
 *
 * Features:
 * - Visual feedback when hovering with a dragged column
 * - Spans the full width of the grid
 * - Only visible during column drag operations
 *
 * @example
 * <NewRowDropZone targetRow={maxRow + 1} columnCount={5} />
 */
export const NewRowDropZone = memo<NewRowDropZoneProps>(
  ({ targetRow, columnCount }) => {
    const { isOver, setNodeRef } = useDroppable({
      id: `new-row-${targetRow}`,
      data: {
        type: NEW_ROW_DROP_TYPE,
        gridRow: targetRow,
        gridCol: 0,
      },
    })

    return (
      <div
        ref={setNodeRef}
        className={cn(
          'h-20 border-2 border-dashed rounded-xl',
          'flex items-center justify-center',
          'text-sm text-muted-foreground font-medium',
          'transition-all duration-200',
          isOver
            ? 'border-primary bg-primary/10 text-primary scale-[1.02]'
            : 'border-border/50 bg-background/30',
        )}
        style={{
          gridColumn: `1 / span ${columnCount}`,
          gridRow: targetRow + 1, // CSS grid is 1-indexed
        }}
      >
        {isOver
          ? '✓ Drop to create new row'
          : 'Drop column here to create new row'}
      </div>
    )
  },
)

NewRowDropZone.displayName = 'NewRowDropZone'

export default NewRowDropZone
