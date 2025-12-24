'use client'

import { useDroppable } from '@dnd-kit/core'
import { memo } from 'react'

import { cn } from '@/lib/utils'

/**
 * Drop zone type identifier for column insertion
 * Used to distinguish insertion drops from column swaps in DndContext
 */
export const COLUMN_INSERT_DROP_TYPE = 'column-insert'

interface ColumnInsertZoneProps {
  /** Target row index for insertion (0-indexed) */
  gridRow: number
  /** Target column index for insertion (0-indexed) */
  gridCol: number
  /** ID of the column being dragged (to exclude self-insertion) */
  activeColumnId?: string
}

/**
 * Column Insert Zone Component
 *
 * A droppable zone that appears at empty grid positions during column drag.
 * When a column is dropped here, it will be placed at this exact grid position.
 *
 * Features:
 * - Positioned within CSS Grid using gridRow/gridColumn
 * - Visual feedback when hovering with a dragged column
 * - Only visible during column drag operations
 *
 * @example
 * <ColumnInsertZone
 *   gridRow={0}
 *   gridCol={1}
 *   activeColumnId="col-backlog"
 * />
 */
export const ColumnInsertZone = memo<ColumnInsertZoneProps>(
  ({ gridRow, gridCol, activeColumnId: _activeColumnId }) => {
    const zoneId = `insert-zone-${gridRow}-${gridCol}`

    const { isOver, setNodeRef } = useDroppable({
      id: zoneId,
      data: {
        type: COLUMN_INSERT_DROP_TYPE,
        gridRow,
        gridCol,
      },
    })

    return (
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[200px] rounded-xl transition-all duration-200',
          'border-2 border-dashed',
          isOver
            ? 'border-primary bg-primary/20 scale-105'
            : 'border-muted-foreground/30 bg-muted/10 hover:border-muted-foreground/50 hover:bg-muted/20',
        )}
        style={{
          gridRow: gridRow + 1, // CSS grid is 1-indexed
          gridColumn: gridCol + 1,
          minWidth: '280px',
        }}
        aria-label={`Insert column at row ${gridRow + 1}, column ${gridCol + 1}`}
      >
        <div className="flex items-center justify-center h-full">
          <div
            className={cn(
              'text-center p-4 rounded-lg transition-all duration-200',
              isOver ? 'text-primary font-medium' : 'text-muted-foreground/50',
            )}
          >
            {isOver ? (
              <span className="text-sm">Drop here to insert</span>
            ) : (
              <span className="text-xs">Empty slot</span>
            )}
          </div>
        </div>
      </div>
    )
  },
)

ColumnInsertZone.displayName = 'ColumnInsertZone'

export default ColumnInsertZone
