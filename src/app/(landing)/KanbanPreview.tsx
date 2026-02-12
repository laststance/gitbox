'use client'

import { Columns3 } from 'lucide-react'
import React, { memo, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * Card data structure for the Kanban preview.
 */
interface KanbanCard {
  /** Unique identifier for the card */
  id: string
  /** Display name of the card */
  name: string
  /** Tailwind CSS classes for background and border colors */
  color: string
}

/**
 * Column data structure for the Kanban preview.
 */
interface KanbanColumn {
  /** Unique identifier for the column */
  id: string
  /** Display title of the column */
  title: string
  /** Cards contained in this column */
  cards: KanbanCard[]
}

/**
 * Initial columns data for the Kanban preview.
 * Layout (4 columns x 2 rows):
 * Row 1: Idea, Design, Development, Production Release
 * Row 2: Planning, Spec Review, (empty), (empty)
 */
const INITIAL_COLUMNS: KanbanColumn[] = [
  // Row 1
  {
    id: 'idea',
    title: 'Idea',
    cards: [
      {
        id: 'ai-agent',
        name: 'AI Agent',
        color: 'bg-violet-500/20 border-violet-500/30',
      },
      {
        id: 'smart-home',
        name: 'Smart Home',
        color: 'bg-teal-500/20 border-teal-500/30',
      },
    ],
  },
  {
    id: 'design',
    title: 'Design',
    cards: [
      {
        id: 'strawberry',
        name: 'Strawberry',
        color: 'bg-purple-500/20 border-purple-500/30',
      },
    ],
  },
  {
    id: 'development',
    title: 'Development',
    cards: [
      {
        id: 'lemonade',
        name: 'Lemonade',
        color: 'bg-amber-500/20 border-amber-500/30',
      },
    ],
  },
  {
    id: 'production-release',
    title: 'Production Release',
    cards: [
      {
        id: 'secret notes',
        name: 'Secret Notes',
        color: 'bg-cyan-500/20 border-cyan-500/30',
      },
      {
        id: 'lifelog app',
        name: 'Lifelog App',
        color: 'bg-rose-500/20 border-rose-500/30',
      },
    ],
  },
  // Row 2
  {
    id: 'planning',
    title: 'Planning',
    cards: [
      {
        id: 'dream board',
        name: 'Dream Board',
        color: 'bg-blue-500/20 border-blue-500/30',
      },
      {
        id: 'tiktok dashboard',
        name: 'TikTok Dashboard',
        color: 'bg-emerald-500/20 border-emerald-500/30',
      },
      {
        id: 'organify',
        name: 'Organify',
        color: 'bg-orange-500/20 border-orange-500/30',
      },
    ],
  },
  {
    id: 'spec-review',
    title: 'Spec Review',
    cards: [
      {
        id: 'api-gateway',
        name: 'API Gateway',
        color: 'bg-indigo-500/20 border-indigo-500/30',
      },
    ],
  },
  // Empty placeholder columns to fill the 4-column grid
  {
    id: 'empty-1',
    title: '',
    cards: [],
  },
  {
    id: 'empty-2',
    title: '',
    cards: [],
  },
]

/** Drag type constants to distinguish between card and column drags */
const DRAG_TYPE = {
  CARD: 'card',
  COLUMN: 'column',
} as const

/**
 * Interactive Kanban Preview Component with HTML5 Drag & Drop.
 * Demonstrates drag-and-drop functionality for both cards and columns.
 * Columns can be reordered by dragging their headers.
 */
export const KanbanPreview = memo(function KanbanPreview() {
  const [columns, setColumns] = useState<KanbanColumn[]>(INITIAL_COLUMNS)
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  // Column drag state
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)
  const [dragOverColumnIndex, setDragOverColumnIndex] = useState<number | null>(
    null,
  )

  /**
   * Handles the start of a card drag operation.
   * @param e - The drag event
   * @param card - The card being dragged
   * @param sourceColumnId - The ID of the column the card is being dragged from
   */
  const handleCardDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    card: KanbanCard,
    sourceColumnId: string,
  ) => {
    setDraggedCard(card)
    e.dataTransfer.setData('dragType', DRAG_TYPE.CARD)
    e.dataTransfer.setData('cardId', card.id)
    e.dataTransfer.setData('sourceColumnId', sourceColumnId)
    e.dataTransfer.effectAllowed = 'move'

    // Capture the element reference BEFORE requestAnimationFrame
    const target = e.target as HTMLElement
    requestAnimationFrame(() => {
      if (target) {
        target.style.opacity = '0.5'
      }
    })
  }

  /**
   * Handles the end of a card drag operation.
   * @param e - The drag event
   */
  const handleCardDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target) {
      target.style.opacity = '1'
    }
    setDraggedCard(null)
    setDragOverColumn(null)
  }

  /**
   * Handles drag over event for card drops on columns.
   * @param e - The drag event
   * @param columnId - The ID of the column being dragged over
   */
  const handleCardDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    columnId: string,
  ) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!draggedColumnId) {
      setDragOverColumn(columnId)
    }
  }

  /**
   * Handles drag leave event for card drop zones.
   */
  const handleCardDragLeave = () => {
    setDragOverColumn(null)
  }

  /**
   * Handles drop event for cards on columns.
   * Moves the card from source column to target column.
   * @param e - The drag event
   * @param targetColumnId - The ID of the column where the card is dropped
   */
  const handleCardDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetColumnId: string,
  ) => {
    e.preventDefault()
    const dragType = e.dataTransfer.getData('dragType')

    if (dragType !== DRAG_TYPE.CARD) return

    const cardId = e.dataTransfer.getData('cardId')
    const sourceColumnId = e.dataTransfer.getData('sourceColumnId')

    if (sourceColumnId === targetColumnId) {
      setDragOverColumn(null)
      return
    }

    setColumns((prevColumns) => {
      const newColumns = prevColumns.map((col) => ({
        ...col,
        cards: [...col.cards],
      }))

      const sourceColumn = newColumns.find((col) => col.id === sourceColumnId)
      const targetColumn = newColumns.find((col) => col.id === targetColumnId)

      if (!sourceColumn || !targetColumn) return prevColumns

      const cardIndex = sourceColumn.cards.findIndex(
        (card) => card.id === cardId,
      )
      if (cardIndex === -1) return prevColumns

      const movedCard = sourceColumn.cards.splice(cardIndex, 1)[0]
      if (movedCard) {
        targetColumn.cards.push(movedCard)
      }

      return newColumns
    })

    setDragOverColumn(null)
  }

  /**
   * Handles the start of a column drag operation.
   * @param e - The drag event
   * @param columnId - The ID of the column being dragged
   */
  const handleColumnDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    columnId: string,
  ) => {
    setDraggedColumnId(columnId)
    e.dataTransfer.setData('dragType', DRAG_TYPE.COLUMN)
    e.dataTransfer.setData('columnId', columnId)
    e.dataTransfer.effectAllowed = 'move'

    // Capture the element reference BEFORE requestAnimationFrame
    // (e.currentTarget becomes null after event handler returns)
    const target = e.currentTarget as HTMLElement
    requestAnimationFrame(() => {
      if (target) {
        target.style.opacity = '0.5'
      }
    })
  }

  /**
   * Handles the end of a column drag operation.
   * @param e - The drag event
   */
  const handleColumnDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLElement
    if (target) {
      target.style.opacity = '1'
    }
    setDraggedColumnId(null)
    setDragOverColumnIndex(null)
  }

  /**
   * Handles drag over event for column reordering.
   * @param e - The drag event
   * @param targetIndex - The index where the column would be dropped
   */
  const handleColumnDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedColumnId) return

    const draggedIndex = columns.findIndex((col) => col.id === draggedColumnId)
    if (draggedIndex === targetIndex) {
      setDragOverColumnIndex(null)
      return
    }

    setDragOverColumnIndex(targetIndex)
  }

  /**
   * Handles drop event for column reordering.
   * Moves the column to the new position.
   * @param e - The drag event
   * @param targetIndex - The index where the column is dropped
   */
  const handleColumnDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const dragType = e.dataTransfer.getData('dragType')
    if (dragType !== DRAG_TYPE.COLUMN) return

    const columnId = e.dataTransfer.getData('columnId')
    const sourceIndex = columns.findIndex((col) => col.id === columnId)

    if (sourceIndex === -1 || sourceIndex === targetIndex) {
      setDragOverColumnIndex(null)
      setDraggedColumnId(null)
      return
    }

    setColumns((prevColumns) => {
      const newColumns = [...prevColumns]
      const movedColumn = newColumns.splice(sourceIndex, 1)[0]
      if (movedColumn) {
        newColumns.splice(targetIndex, 0, movedColumn)
      }
      return newColumns
    })

    setDragOverColumnIndex(null)
    setDraggedColumnId(null)
  }

  return (
    <div className="relative mx-auto mt-16 w-full max-w-4xl">
      {/* Browser chrome */}
      <div className="border-border/50 bg-background/50 overflow-hidden rounded-xl border shadow-2xl backdrop-blur-sm">
        {/* Title bar */}
        <div className="border-border/50 bg-muted/30 flex items-center gap-2 border-b px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/70" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <div className="h-3 w-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 text-center">
            <div className="bg-muted/50 text-muted-foreground inline-flex items-center gap-2 rounded-md px-4 py-1 text-xs">
              <Columns3 className="h-3 w-3" />
              My Projects Board
            </div>
          </div>
        </div>

        {/* Kanban board - 4 columns layout */}
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((column, idx) => (
            <div
              key={column.id}
              data-testid={`kanban-column-${column.id}`}
              draggable
              onDragStart={(e) => handleColumnDragStart(e, column.id)}
              onDragEnd={handleColumnDragEnd}
              onDragOver={(e) => {
                handleColumnDragOver(e, idx)
                handleCardDragOver(e, column.id)
              }}
              onDragLeave={handleCardDragLeave}
              onDrop={(e) => {
                const dragType = e.dataTransfer.getData('dragType')
                if (dragType === DRAG_TYPE.COLUMN) {
                  handleColumnDrop(e, idx)
                } else {
                  handleCardDrop(e, column.id)
                }
              }}
              className={cn(
                'rounded-lg border p-3 transition-all duration-200',
                // Empty placeholder column styling
                column.id.startsWith('empty-')
                  ? 'border-border/30 border-dashed bg-transparent'
                  : 'border-border/40 bg-muted/20 shadow-sm',
                // Card drop highlight
                dragOverColumn === column.id &&
                  !draggedColumnId &&
                  'border-primary/50 bg-primary/5 shadow-md',
                // Column being dragged
                draggedColumnId === column.id && 'scale-[0.98] opacity-50',
                // Column drop target indicator
                dragOverColumnIndex === idx &&
                  draggedColumnId &&
                  draggedColumnId !== column.id &&
                  'ring-primary ring-offset-background ring-2 ring-offset-2',
              )}
              style={{
                animation: `fadeInUp 0.5s ease-out ${idx * 0.08}s forwards`,
                opacity: 0,
                cursor: draggedColumnId ? 'grabbing' : 'grab',
              }}
            >
              {/* Column header - draggable handle */}
              <div
                className={cn(
                  'flex cursor-grab items-center justify-between active:cursor-grabbing',
                  column.id.startsWith('empty-')
                    ? 'mb-0 justify-center'
                    : 'mb-3',
                )}
              >
                {column.id.startsWith('empty-') ? null : (
                  // Regular column - show title and count
                  <>
                    <span className="text-muted-foreground text-xs font-medium">
                      {column.title}
                    </span>
                    <span
                      className="text-muted-foreground/60 text-xs"
                      data-testid={`column-count-${column.id}`}
                    >
                      {column.cards.length}
                    </span>
                  </>
                )}
              </div>
              {/* Cards container - hidden for empty placeholder columns */}
              {!column.id.startsWith('empty-') && (
                <div className="min-h-15 space-y-2">
                  {column.cards.map((card, cardIdx) => (
                    <div
                      key={card.id}
                      data-testid={`kanban-card-${card.id}`}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        handleCardDragStart(e, card, column.id)
                      }}
                      onDragEnd={handleCardDragEnd}
                      className={cn(
                        'rounded-lg border p-3 transition-all duration-200',
                        'cursor-grab hover:scale-[1.02] hover:shadow-md active:cursor-grabbing',
                        card.color,
                        draggedCard?.id === card.id && 'opacity-50',
                      )}
                      style={{
                        animation: `fadeInUp 0.4s ease-out ${idx * 0.08 + cardIdx * 0.04 + 0.15}s forwards`,
                        opacity: 0,
                      }}
                    >
                      <span className="text-foreground text-xs font-medium">
                        {card.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Decorative elements */}
      <div className="from-primary/5 absolute -bottom-8 left-1/2 h-16 w-2/3 -translate-x-1/2 bg-linear-to-b to-transparent blur-2xl" />
    </div>
  )
})
