/**
 * ColumnInsertZone Component Stories
 *
 * A droppable zone that appears at empty grid positions during column drag.
 * When a column is dropped here, it will be placed at this exact grid position.
 *
 * Features:
 * - Positioned within CSS Grid using gridRow/gridColumn
 * - Visual feedback when hovering with a dragged column
 * - Only visible during column drag operations
 */

import { DndContext } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ColumnInsertZone } from './ColumnInsertZone'

const meta = {
  title: 'Board/ColumnInsertZone',
  component: ColumnInsertZone,
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
            gridTemplateRows: 'repeat(2, 250px)',
          }}
        >
          <Story />
        </div>
      </DndContext>
    ),
  ],
} satisfies Meta<typeof ColumnInsertZone>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default insert zone at grid position (0, 0).
 * Shows the empty slot indicator.
 */
export const Default: Story = {
  args: {
    gridRow: 0,
    gridCol: 0,
  },
}

/**
 * Insert zone at a different grid position.
 */
export const AtPosition: Story = {
  args: {
    gridRow: 1,
    gridCol: 2,
  },
}

/**
 * Insert zone with an active column ID.
 * Used to exclude self-insertion during drag.
 */
export const WithActiveColumn: Story = {
  args: {
    gridRow: 0,
    gridCol: 1,
    activeColumnId: 'col-backlog',
  },
}

/**
 * Multiple insert zones in a grid layout.
 * Demonstrates how empty slots appear during column reorganization.
 */
export const GridWithMultipleZones: Story = {
  args: {
    gridRow: 0,
    gridCol: 0,
  },
  decorators: [
    (Story) => (
      <DndContext>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(3, 250px)',
            gridTemplateRows: 'repeat(2, 200px)',
          }}
        >
          <Story />
        </div>
      </DndContext>
    ),
  ],
  render: () => (
    <>
      {/* Simulate an existing column */}
      <div
        className="bg-card border border-border rounded-xl p-4 flex items-center justify-center"
        style={{ gridRow: 1, gridColumn: 1 }}
      >
        <span className="text-muted-foreground">Existing Column</span>
      </div>
      {/* Empty slots where columns can be inserted */}
      <ColumnInsertZone gridRow={0} gridCol={1} activeColumnId="col-1" />
      <ColumnInsertZone gridRow={0} gridCol={2} activeColumnId="col-1" />
      <ColumnInsertZone gridRow={1} gridCol={1} activeColumnId="col-1" />
      <ColumnInsertZone gridRow={1} gridCol={2} activeColumnId="col-1" />
    </>
  ),
}

/**
 * Insert zone at the first column of second row.
 * Common position for expanding the board vertically.
 */
export const NewRowStart: Story = {
  args: {
    gridRow: 1,
    gridCol: 0,
  },
}

/**
 * Sparse grid with insert zones filling gaps.
 * Shows how insert zones help visualize available positions.
 */
export const SparseGrid: Story = {
  args: {
    gridRow: 0,
    gridCol: 0,
  },
  decorators: [
    (Story) => (
      <DndContext>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(4, 200px)',
            gridTemplateRows: 'repeat(3, 180px)',
          }}
        >
          <Story />
        </div>
      </DndContext>
    ),
  ],
  render: () => (
    <>
      {/* Existing columns scattered in the grid */}
      <div
        className="bg-card border border-border rounded-xl p-4 flex items-center justify-center"
        style={{ gridRow: 1, gridColumn: 1 }}
      >
        <span className="text-muted-foreground text-sm">To Do</span>
      </div>
      <div
        className="bg-card border border-border rounded-xl p-4 flex items-center justify-center"
        style={{ gridRow: 1, gridColumn: 3 }}
      >
        <span className="text-muted-foreground text-sm">In Progress</span>
      </div>
      <div
        className="bg-card border border-border rounded-xl p-4 flex items-center justify-center"
        style={{ gridRow: 2, gridColumn: 2 }}
      >
        <span className="text-muted-foreground text-sm">Done</span>
      </div>
      {/* Insert zones for empty positions */}
      <ColumnInsertZone gridRow={0} gridCol={1} />
      <ColumnInsertZone gridRow={0} gridCol={3} />
      <ColumnInsertZone gridRow={1} gridCol={0} />
      <ColumnInsertZone gridRow={1} gridCol={3} />
      <ColumnInsertZone gridRow={2} gridCol={0} />
      <ColumnInsertZone gridRow={2} gridCol={2} />
      <ColumnInsertZone gridRow={2} gridCol={3} />
    </>
  ),
}
