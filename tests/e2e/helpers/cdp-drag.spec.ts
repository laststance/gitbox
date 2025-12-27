/**
 * CDP Drag Helper Integration Tests
 *
 * Validates that the CDP drag helper functions work correctly
 * with the actual Kanban board implementation.
 *
 * @remarks
 * - Tests CDP session creation and mouse event dispatching
 * - Verifies isTrusted: true events for @dnd-kit compatibility
 * - Only works with Chromium-based browsers
 */

import { test, expect } from '../fixtures/coverage'

test.describe('CDP Drag Helper Integration', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test.beforeEach(async ({ request }) => {
    await request.post('/__msw__/reset')
  })

  /**
   * Test that CDP session can be created and used.
   */
  test('should create CDP session successfully', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    const client = await page.context().newCDPSession(page)

    // Verify CDP session is active by sending a simple command
    const result = await client.send('Runtime.evaluate', {
      expression: 'window.location.href',
    })

    expect(result.result.value).toContain('/board/board-1')

    await client.detach()
  })

  /**
   * Test that CDP mouse events are received by the page.
   */
  test('should dispatch CDP mouse events', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    const client = await page.context().newCDPSession(page)

    try {
      // Listen for mouse events in the page
      await page.evaluate(() => {
        ;(window as { __mouseEvents?: string[] }).__mouseEvents = []
        document.addEventListener('mousedown', () => {
          ;(window as { __mouseEvents?: string[] }).__mouseEvents?.push(
            'mousedown',
          )
        })
        document.addEventListener('mouseup', () => {
          ;(window as { __mouseEvents?: string[] }).__mouseEvents?.push(
            'mouseup',
          )
        })
        document.addEventListener('mousemove', () => {
          ;(window as { __mouseEvents?: string[] }).__mouseEvents?.push(
            'mousemove',
          )
        })
      })

      // Dispatch CDP events
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: 100,
        y: 100,
        button: 'none',
        buttons: 0,
      })

      await client.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: 100,
        y: 100,
        button: 'left',
        clickCount: 1,
        buttons: 1,
      })

      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: 100,
        y: 100,
        button: 'left',
        clickCount: 1,
        buttons: 0,
      })

      await page.waitForTimeout(100)

      // Verify events were received
      const events = await page.evaluate(() => {
        return (window as { __mouseEvents?: string[] }).__mouseEvents
      })

      expect(events).toContain('mousemove')
      expect(events).toContain('mousedown')
      expect(events).toContain('mouseup')
    } finally {
      await client.detach()
    }
  })

  /**
   * Test that CDP events have isTrusted = true.
   * This is the critical requirement for @dnd-kit compatibility.
   */
  test('should generate isTrusted events via CDP', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    const client = await page.context().newCDPSession(page)

    try {
      // Track isTrusted value of events
      await page.evaluate(() => {
        ;(window as { __trustedEvents?: boolean[] }).__trustedEvents = []
        document.addEventListener('mousedown', (e) => {
          ;(window as { __trustedEvents?: boolean[] }).__trustedEvents?.push(
            e.isTrusted,
          )
        })
      })

      // Dispatch via CDP (should be trusted)
      await client.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: 200,
        y: 200,
        button: 'left',
        clickCount: 1,
        buttons: 1,
      })

      await page.waitForTimeout(50)

      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: 200,
        y: 200,
        button: 'left',
        clickCount: 1,
        buttons: 0,
      })

      const trustedValues = await page.evaluate(() => {
        return (window as { __trustedEvents?: boolean[] }).__trustedEvents
      })

      // CDP events should be trusted
      expect(trustedValues?.length).toBeGreaterThan(0)
      expect(trustedValues?.[0]).toBe(true)
    } finally {
      await client.detach()
    }
  })
})
