/**
 * CDP-based Drag and Drop Helper for @dnd-kit E2E Testing
 *
 * Uses Chrome DevTools Protocol (CDP) to dispatch mouse events at the browser
 * process level, generating `isTrusted: true` events that @dnd-kit accepts.
 *
 * @remarks
 * - Only works with Chromium-based browsers (V8/CDP API)
 * - @dnd-kit validates `event.isTrusted === true` for security
 * - Playwright's high-level APIs create `isTrusted: false` synthetic events
 * - CDP Input.dispatchMouseEvent injects events at the OS input layer
 *
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchMouseEvent
 */

import type { Page, CDPSession } from '@playwright/test'

/**
 * Mouse button bitmask values for CDP Input.dispatchMouseEvent
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Input/#type-MouseButton
 */
const MOUSE_BUTTONS = {
  none: 0,
  left: 1,
  right: 2,
  middle: 4,
} as const

/**
 * CDP mouse event type literals
 */
type CDPMouseEventType = 'mousePressed' | 'mouseMoved' | 'mouseReleased'

/**
 * Coordinates type for CDP mouse events
 */
interface Coordinates {
  x: number
  y: number
}

/**
 * Options for CDP drag operation
 */
interface CDPDragOptions {
  /**
   * Number of intermediate steps between source and target.
   * More steps = smoother animation but slower execution.
   * @default 10
   */
  steps?: number

  /**
   * Delay in milliseconds between each step.
   * Allows UI to react to intermediate positions.
   * @default 50
   */
  stepDelay?: number

  /**
   * Delay before releasing the mouse after reaching target.
   * Gives @dnd-kit time to process the drop zone.
   * @default 100
   */
  dropDelay?: number
}

/**
 * Dispatches a mouse event via CDP at the browser process level.
 * Creates `isTrusted: true` events that pass @dnd-kit's security validation.
 *
 * @param client - CDP session from `page.context().newCDPSession(page)`
 * @param type - Mouse event type: 'mousePressed', 'mouseMoved', 'mouseReleased'
 * @param coords - Target coordinates { x, y }
 * @param button - Mouse button: 'left', 'right', 'middle', 'none'
 * @param clickCount - Number of clicks (1 for single click)
 *
 * @example
 * ```typescript
 * const client = await page.context().newCDPSession(page);
 * await dispatchMouseEvent(client, 'mousePressed', { x: 100, y: 200 }, 'left', 1);
 * ```
 */
async function dispatchMouseEvent(
  client: CDPSession,
  type: CDPMouseEventType,
  coords: Coordinates,
  button: 'left' | 'right' | 'middle' | 'none' = 'left',
  clickCount = 1,
): Promise<void> {
  const buttons =
    type === 'mouseReleased' ? MOUSE_BUTTONS.none : MOUSE_BUTTONS[button]

  await client.send('Input.dispatchMouseEvent', {
    type,
    x: coords.x,
    y: coords.y,
    button,
    clickCount,
    buttons,
  })
}

/**
 * Calculates linear interpolation between two coordinates.
 *
 * @param start - Starting coordinates
 * @param end - Ending coordinates
 * @param steps - Number of intermediate steps
 * @returns Array of interpolated coordinates (excluding start, including end)
 *
 * @example
 * ```typescript
 * const points = interpolateCoordinates({ x: 0, y: 0 }, { x: 100, y: 50 }, 5);
 * // Returns: [{ x: 20, y: 10 }, { x: 40, y: 20 }, ..., { x: 100, y: 50 }]
 * ```
 */
function interpolateCoordinates(
  start: Coordinates,
  end: Coordinates,
  steps: number,
): Coordinates[] {
  const result: Coordinates[] = []

  for (let i = 1; i <= steps; i++) {
    const ratio = i / steps
    result.push({
      x: Math.round(start.x + (end.x - start.x) * ratio),
      y: Math.round(start.y + (end.y - start.y) * ratio),
    })
  }

  return result
}

/**
 * Pauses execution for the specified duration.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Gets the center coordinates of an element by selector.
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector or data-testid selector
 * @returns Center coordinates { x, y } of the element
 * @throws Error if element is not found or not visible
 *
 * @example
 * ```typescript
 * const coords = await getElementCenter(page, '[data-testid="sortable-column-1"]');
 * // Returns: { x: 150, y: 200 }
 * ```
 */
async function getElementCenter(
  page: Page,
  selector: string,
): Promise<Coordinates> {
  const element = page.locator(selector)
  await element.waitFor({ state: 'visible', timeout: 10000 })

  const box = await element.boundingBox()
  if (!box) {
    throw new Error(`Element not visible or has no bounding box: ${selector}`)
  }

  return {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  }
}

/**
 * Gets the drag handle coordinates for a column (header area).
 * The drag handle is the column header which initiates column reordering.
 *
 * @param page - Playwright Page instance
 * @param columnSelector - Selector for the sortable column wrapper
 * @returns Coordinates of the drag handle (header center)
 *
 * @example
 * ```typescript
 * const coords = await getColumnDragHandleCenter(page, '[data-testid="sortable-column-status-1"]');
 * ```
 */
async function getColumnDragHandleCenter(
  page: Page,
  columnSelector: string,
): Promise<Coordinates> {
  const element = page.locator(columnSelector)
  await element.waitFor({ state: 'visible', timeout: 10000 })

  const box = await element.boundingBox()
  if (!box) {
    throw new Error(
      `Column not visible or has no bounding box: ${columnSelector}`,
    )
  }

  // The drag handle is at the top of the column (header area)
  // Target the upper portion (first 60px) for reliable drag initiation
  return {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + 30), // 30px from top for header drag handle
  }
}

/**
 * Performs a drag and drop operation using CDP events.
 * Creates `isTrusted: true` events that @dnd-kit accepts.
 *
 * @param page - Playwright Page instance
 * @param sourceSelector - CSS selector for the source element
 * @param targetSelector - CSS selector for the target element
 * @param options - Drag configuration options
 *
 * @example
 * ```typescript
 * // Drag column 1 to column 3's position
 * await cdpDragAndDrop(
 *   page,
 *   '[data-testid="sortable-column-status-1"]',
 *   '[data-testid="sortable-column-status-3"]',
 *   { steps: 15, stepDelay: 30 }
 * );
 * ```
 */
export async function cdpDragAndDrop(
  page: Page,
  sourceSelector: string,
  targetSelector: string,
  options: CDPDragOptions = {},
): Promise<void> {
  const { steps = 10, stepDelay = 50, dropDelay = 100 } = options

  // Create CDP session for low-level input injection
  const client = await page.context().newCDPSession(page)

  try {
    // Get source and target coordinates
    const sourceCoords = await getElementCenter(page, sourceSelector)
    const targetCoords = await getElementCenter(page, targetSelector)

    // 1. Move to source position (hover)
    await dispatchMouseEvent(client, 'mouseMoved', sourceCoords, 'none', 0)
    await sleep(50)

    // 2. Press mouse button at source (initiate drag)
    await dispatchMouseEvent(client, 'mousePressed', sourceCoords, 'left', 1)
    await sleep(100) // Allow @dnd-kit to recognize drag start

    // 3. Move through intermediate points (smooth drag animation)
    const intermediatePoints = interpolateCoordinates(
      sourceCoords,
      targetCoords,
      steps,
    )
    for (const point of intermediatePoints) {
      await dispatchMouseEvent(client, 'mouseMoved', point, 'left', 0)
      await sleep(stepDelay)
    }

    // 4. Extra hover at target (trigger dragover events reliably)
    await dispatchMouseEvent(client, 'mouseMoved', targetCoords, 'left', 0)
    await sleep(dropDelay)

    // 5. Release mouse button (complete drop)
    await dispatchMouseEvent(client, 'mouseReleased', targetCoords, 'left', 1)
    await sleep(100) // Allow UI to settle after drop
  } finally {
    // Clean up CDP session
    await client.detach()
  }
}

/**
 * Performs a column drag and drop operation using CDP events.
 * Specifically handles @dnd-kit column reordering in KanbanBoard.
 *
 * @param page - Playwright Page instance
 * @param sourceColumnId - Status list ID of the source column
 * @param targetColumnId - Status list ID of the target column
 * @param options - Drag configuration options
 *
 * @example
 * ```typescript
 * // Drag "Backlog" column to "Done" column's position
 * await cdpColumnDragAndDrop(page, 'status-1', 'status-5');
 * ```
 */
export async function cdpColumnDragAndDrop(
  page: Page,
  sourceColumnId: string,
  targetColumnId: string,
  options: CDPDragOptions = {},
): Promise<void> {
  const { steps = 15, stepDelay = 40, dropDelay = 150 } = options

  // Create CDP session
  const client = await page.context().newCDPSession(page)

  try {
    // Get drag handle coordinates (column headers)
    const sourceSelector = `[data-testid="sortable-column-${sourceColumnId}"]`
    const targetSelector = `[data-testid="sortable-column-${targetColumnId}"]`

    const sourceCoords = await getColumnDragHandleCenter(page, sourceSelector)
    const targetCoords = await getColumnDragHandleCenter(page, targetSelector)

    // Calculate overshoot position - @dnd-kit sortable needs drag PAST target center to trigger swap
    // Add 100px overshoot in the drag direction (horizontal)
    const overshootX = targetCoords.x > sourceCoords.x ? 150 : -150
    const overshootCoords: Coordinates = {
      x: targetCoords.x + overshootX,
      y: targetCoords.y,
    }

    // 1. Move to source column header
    await dispatchMouseEvent(client, 'mouseMoved', sourceCoords, 'none', 0)
    await sleep(50)

    // 2. Press to initiate column drag
    await dispatchMouseEvent(client, 'mousePressed', sourceCoords, 'left', 1)
    await sleep(150) // @dnd-kit needs time to detect drag start

    // 3. Drag through intermediate points with smooth motion
    const points = interpolateCoordinates(sourceCoords, overshootCoords, steps)
    for (const point of points) {
      await dispatchMouseEvent(client, 'mouseMoved', point, 'left', 0)
      await sleep(stepDelay)
    }

    // 4. Hold at overshoot position (allow drop zone detection)
    await dispatchMouseEvent(client, 'mouseMoved', overshootCoords, 'left', 0)
    await sleep(dropDelay)

    // 5. Release at overshoot to complete column reorder
    await dispatchMouseEvent(
      client,
      'mouseReleased',
      overshootCoords,
      'left',
      1,
    )
    await sleep(200) // Allow animation to complete
  } finally {
    await client.detach()
  }
}

/**
 * Performs a card drag and drop operation within or between columns.
 *
 * @param page - Playwright Page instance
 * @param sourceCardId - RepoCard ID to drag
 * @param targetCardId - RepoCard ID to drop onto (for reordering)
 * @param options - Drag configuration options
 *
 * @example
 * ```typescript
 * // Move card-1 before card-3
 * await cdpCardDragAndDrop(page, 'card-1', 'card-3');
 * ```
 */
export async function cdpCardDragAndDrop(
  page: Page,
  sourceCardId: string,
  targetCardId: string,
  options: CDPDragOptions = {},
): Promise<void> {
  const { steps = 10, stepDelay = 40, dropDelay = 100 } = options

  const client = await page.context().newCDPSession(page)

  try {
    const sourceSelector = `[data-testid="repo-card-${sourceCardId}"]`
    const targetSelector = `[data-testid="repo-card-${targetCardId}"]`

    const sourceCoords = await getElementCenter(page, sourceSelector)
    const targetCoords = await getElementCenter(page, targetSelector)

    // Initiate drag
    await dispatchMouseEvent(client, 'mouseMoved', sourceCoords, 'none', 0)
    await sleep(50)
    await dispatchMouseEvent(client, 'mousePressed', sourceCoords, 'left', 1)
    await sleep(100)

    // Smooth drag motion
    const points = interpolateCoordinates(sourceCoords, targetCoords, steps)
    for (const point of points) {
      await dispatchMouseEvent(client, 'mouseMoved', point, 'left', 0)
      await sleep(stepDelay)
    }

    // Hold and release
    await dispatchMouseEvent(client, 'mouseMoved', targetCoords, 'left', 0)
    await sleep(dropDelay)
    await dispatchMouseEvent(client, 'mouseReleased', targetCoords, 'left', 1)
    await sleep(100)
  } finally {
    await client.detach()
  }
}

/**
 * Performs a card drag to a column drop zone.
 * Used for moving cards between columns.
 *
 * @param page - Playwright Page instance
 * @param sourceCardId - RepoCard ID to drag
 * @param targetColumnId - Status list ID of the target column
 * @param options - Drag configuration options
 *
 * @example
 * ```typescript
 * // Move card-1 to the "Done" column
 * await cdpCardToColumnDragAndDrop(page, 'card-1', 'status-done');
 * ```
 */
export async function cdpCardToColumnDragAndDrop(
  page: Page,
  sourceCardId: string,
  targetColumnId: string,
  options: CDPDragOptions = {},
): Promise<void> {
  const { steps = 12, stepDelay = 40, dropDelay = 120 } = options

  const client = await page.context().newCDPSession(page)

  try {
    const sourceSelector = `[data-testid="repo-card-${sourceCardId}"]`
    const targetSelector = `[data-testid="status-column-${targetColumnId}"]`

    const sourceCoords = await getElementCenter(page, sourceSelector)

    // Get center of the column's droppable area (mid-height for reliable drop)
    const targetElement = page.locator(targetSelector)
    await targetElement.waitFor({ state: 'visible', timeout: 10000 })
    const box = await targetElement.boundingBox()
    if (!box) {
      throw new Error(`Target column not visible: ${targetSelector}`)
    }
    const targetCoords: Coordinates = {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
    }

    // Drag sequence
    await dispatchMouseEvent(client, 'mouseMoved', sourceCoords, 'none', 0)
    await sleep(50)
    await dispatchMouseEvent(client, 'mousePressed', sourceCoords, 'left', 1)
    await sleep(100)

    const points = interpolateCoordinates(sourceCoords, targetCoords, steps)
    for (const point of points) {
      await dispatchMouseEvent(client, 'mouseMoved', point, 'left', 0)
      await sleep(stepDelay)
    }

    await dispatchMouseEvent(client, 'mouseMoved', targetCoords, 'left', 0)
    await sleep(dropDelay)
    await dispatchMouseEvent(client, 'mouseReleased', targetCoords, 'left', 1)
    await sleep(100)
  } finally {
    await client.detach()
  }
}

/**
 * Performs a column drag to the NewRowDropZone.
 * Moves a column to create a new row in the 2D grid layout.
 *
 * The NewRowDropZone appears at the bottom of the grid when dragging columns,
 * allowing users to create multi-row Kanban board layouts.
 *
 * @param page - Playwright Page instance
 * @param sourceColumnId - Status list ID of the column to drag
 * @param targetRow - Target row index for the NewRowDropZone (typically maxRow + 1)
 * @param options - Drag configuration options
 *
 * @example
 * ```typescript
 * // Move "Backlog" column to a new second row
 * await cdpColumnToNewRowDragAndDrop(page, 'status-1', 1);
 * ```
 */
export async function cdpColumnToNewRowDragAndDrop(
  page: Page,
  sourceColumnId: string,
  targetRow: number,
  options: CDPDragOptions = {},
): Promise<void> {
  const { steps = 20, stepDelay = 35, dropDelay = 200 } = options

  // Suppress unused variable - targetRow is used for documentation and future extension
  void targetRow

  const client = await page.context().newCDPSession(page)

  try {
    // Get source column's drag handle coordinates
    const sourceSelector = `[data-testid="sortable-column-${sourceColumnId}"]`
    const sourceCoords = await getColumnDragHandleCenter(page, sourceSelector)

    // 1. Move to source and initiate drag
    await dispatchMouseEvent(client, 'mouseMoved', sourceCoords, 'none', 0)
    await sleep(50)
    await dispatchMouseEvent(client, 'mousePressed', sourceCoords, 'left', 1)
    await sleep(200) // Extra time for @dnd-kit to initialize drag state

    // 2. Move down slightly to trigger NewRowDropZone visibility
    // NewRowDropZone only appears during active column drag
    const midPoint: Coordinates = {
      x: sourceCoords.x,
      y: sourceCoords.y + 100, // Move down to make drop zone appear
    }
    await dispatchMouseEvent(client, 'mouseMoved', midPoint, 'left', 0)
    await sleep(150)

    // 3. Wait for NewRowDropZone to become visible and get its coordinates
    const dropZoneSelector = `[class*="border-dashed"]:has-text("Drop column")`
    let targetCoords: Coordinates

    try {
      const dropZone = page.locator(dropZoneSelector).first()
      await dropZone.waitFor({ state: 'visible', timeout: 3000 })

      const box = await dropZone.boundingBox()
      if (box) {
        targetCoords = {
          x: Math.round(box.x + box.width / 2),
          y: Math.round(box.y + box.height / 2),
        }
      } else {
        // Fallback: estimate drop zone position (bottom of grid area)
        const gridContainer = page.locator('.grid.gap-4.pb-4').first()
        const gridBox = await gridContainer.boundingBox()
        if (!gridBox) throw new Error('Grid container not found')

        targetCoords = {
          x: Math.round(gridBox.x + gridBox.width / 2),
          y: Math.round(gridBox.y + gridBox.height + 50),
        }
      }
    } catch {
      // Fallback if drop zone not found: calculate estimated position
      const viewport = page.viewportSize()
      if (!viewport) throw new Error('Viewport not available')

      targetCoords = {
        x: Math.round(viewport.width / 2),
        y: Math.round(viewport.height - 100), // Near bottom of viewport
      }
    }

    // 4. Drag to NewRowDropZone with smooth motion
    const points = interpolateCoordinates(midPoint, targetCoords, steps)
    for (const point of points) {
      await dispatchMouseEvent(client, 'mouseMoved', point, 'left', 0)
      await sleep(stepDelay)
    }

    // 5. Hold at drop zone (allow visual feedback and drop detection)
    await dispatchMouseEvent(client, 'mouseMoved', targetCoords, 'left', 0)
    await sleep(dropDelay)

    // 6. Release to complete drop to new row
    await dispatchMouseEvent(client, 'mouseReleased', targetCoords, 'left', 1)
    await sleep(300) // Allow grid reflow animation
  } finally {
    await client.detach()
  }
}

/**
 * Performs a column drag to a specific grid position (2D).
 * Enables precise column placement in the 2D Kanban grid.
 *
 * @param page - Playwright Page instance
 * @param sourceColumnId - Status list ID of the column to drag
 * @param targetGridRow - Target grid row (0-indexed)
 * @param targetGridCol - Target grid column (0-indexed)
 * @param options - Drag configuration options
 *
 * @example
 * ```typescript
 * // Move column to row 1, column 2
 * await cdpColumnToGridPosition(page, 'status-1', 1, 2);
 * ```
 */
export async function cdpColumnToGridPosition(
  page: Page,
  sourceColumnId: string,
  targetGridRow: number,
  targetGridCol: number,
  options: CDPDragOptions = {},
): Promise<void> {
  const { steps = 18, stepDelay = 35, dropDelay = 180 } = options

  const client = await page.context().newCDPSession(page)

  try {
    // Get source column coordinates
    const sourceSelector = `[data-testid="sortable-column-${sourceColumnId}"]`
    const sourceCoords = await getColumnDragHandleCenter(page, sourceSelector)

    // Calculate target position based on grid layout
    // Each column is ~280px wide with gaps
    const COLUMN_WIDTH = 280
    const COLUMN_GAP = 16 // gap-4 = 1rem = 16px
    const COLUMN_HEIGHT = 400 // Approximate column height
    const ROW_GAP = 16
    const GRID_PADDING = 24 // p-6 = 1.5rem = 24px

    // Get grid container position
    const gridContainer = page.locator('.w-fit.min-w-full.h-full.p-6').first()
    const gridBox = await gridContainer.boundingBox()
    if (!gridBox) throw new Error('Grid container not found')

    const targetCoords: Coordinates = {
      x: Math.round(
        gridBox.x +
          GRID_PADDING +
          targetGridCol * (COLUMN_WIDTH + COLUMN_GAP) +
          COLUMN_WIDTH / 2,
      ),
      y: Math.round(
        gridBox.y +
          GRID_PADDING +
          targetGridRow * (COLUMN_HEIGHT + ROW_GAP) +
          60, // Header area
      ),
    }

    // Perform drag sequence
    await dispatchMouseEvent(client, 'mouseMoved', sourceCoords, 'none', 0)
    await sleep(50)
    await dispatchMouseEvent(client, 'mousePressed', sourceCoords, 'left', 1)
    await sleep(150)

    const points = interpolateCoordinates(sourceCoords, targetCoords, steps)
    for (const point of points) {
      await dispatchMouseEvent(client, 'mouseMoved', point, 'left', 0)
      await sleep(stepDelay)
    }

    await dispatchMouseEvent(client, 'mouseMoved', targetCoords, 'left', 0)
    await sleep(dropDelay)
    await dispatchMouseEvent(client, 'mouseReleased', targetCoords, 'left', 1)
    await sleep(200)
  } finally {
    await client.detach()
  }
}
