/**
 * NewRowDropZone Component Stories
 *
 * A droppable area at the bottom of the grid that allows users
 * to move columns to a new row. When a column is dropped here,
 * it will be placed in a new row at the first column position.
 *
 * Features:
 * - Visual feedback when hovering with a dragged column
 * - Spans the full width of the grid
 * - Only visible during column drag operations
 */

import { DndContext } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { NewRowDropZone } from './NewRowDropZone'

const meta = {
  title: 'Board/NewRowDropZone',
  component: NewRowDropZone,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <DndContext>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(3, 300px)',
            minHeight: '200px',
          }}
        >
          <Story />
        </div>
      </DndContext>
    ),
  ],
} satisfies Meta<typeof NewRowDropZone>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default drop zone for creating a new row.
 * Spans across 3 columns (typical board layout).
 */
export const Default: Story = {
  args: {
    targetRow: 2,
    columnCount: 3,
  },
}

/**
 * Drop zone for a single-column board.
 */
export const SingleColumn: Story = {
  decorators: [
    (Story) => (
      <DndContext>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: '300px',
            minHeight: '200px',
          }}
        >
          <Story />
        </div>
      </DndContext>
    ),
  ],
  args: {
    targetRow: 1,
    columnCount: 1,
  },
}

/**
 * Drop zone for a board with many columns.
 * Spans the full width of a 5-column grid.
 */
export const WideGrid: Story = {
  decorators: [
    (Story) => (
      <DndContext>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(5, 200px)',
            minHeight: '200px',
          }}
        >
          <Story />
        </div>
      </DndContext>
    ),
  ],
  args: {
    targetRow: 3,
    columnCount: 5,
  },
}

/**
 * Drop zone at the first row position.
 */
export const FirstRow: Story = {
  args: {
    targetRow: 0,
    columnCount: 3,
  },
}

/**
 * Multiple drop zones in a grid layout.
 * Shows how drop zones can appear at different row positions.
 */
export const MultipleZones: Story = {
  args: {
    targetRow: 2,
    columnCount: 3,
  },
  decorators: [
    (Story) => (
      <DndContext>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(3, 200px)',
            gridTemplateRows: 'repeat(4, auto)',
            minHeight: '400px',
          }}
        >
          <Story />
        </div>
      </DndContext>
    ),
  ],
  render: () => (
    <>
      {/* Placeholder for existing content in rows 0-1 */}
      <div
        className="bg-muted/30 rounded-lg p-4 text-center text-muted-foreground"
        style={{ gridColumn: '1 / span 3', gridRow: 1 }}
      >
        Row 0: Existing columns
      </div>
      <div
        className="bg-muted/30 rounded-lg p-4 text-center text-muted-foreground"
        style={{ gridColumn: '1 / span 3', gridRow: 2 }}
      >
        Row 1: Existing columns
      </div>
      {/* Drop zones for new rows */}
      <NewRowDropZone targetRow={2} columnCount={3} />
      <NewRowDropZone targetRow={3} columnCount={3} />
    </>
  ),
}
