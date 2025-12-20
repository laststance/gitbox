/**
 * E2E Test: Landing Page Kanban Preview Drag & Drop
 *
 * Test scope:
 * - Kanban preview component renders with correct initial state
 * - Cards have draggable attribute for HTML5 D&D
 * - Columns have proper styling (borders, shadows, backgrounds)
 * - Drag and drop functionality moves cards between columns
 * - Card counts update correctly after drag operations
 */

import { test, expect } from '@playwright/test'

test.describe('Landing Page Kanban Preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for animations to complete
    await page.waitForTimeout(1000)
  })

  test.describe('Initial Render', () => {
    test('should render all 4 columns', async ({ page }) => {
      const backlogColumn = page.getByTestId('kanban-column-backlog')
      const inProgressColumn = page.getByTestId('kanban-column-in-progress')
      const reviewColumn = page.getByTestId('kanban-column-review')
      const doneColumn = page.getByTestId('kanban-column-done')

      await expect(backlogColumn).toBeVisible()
      await expect(inProgressColumn).toBeVisible()
      await expect(reviewColumn).toBeVisible()
      await expect(doneColumn).toBeVisible()
    })

    test('should have 3 cards in Backlog column initially', async ({
      page,
    }) => {
      const backlogCount = page.getByTestId('column-count-backlog')
      await expect(backlogCount).toHaveText('3')

      // Verify all 3 cards are present
      const reactCard = page.getByTestId('kanban-card-react')
      const vueCard = page.getByTestId('kanban-card-vue')
      const angularCard = page.getByTestId('kanban-card-angular')

      await expect(reactCard).toBeVisible()
      await expect(vueCard).toBeVisible()
      await expect(angularCard).toBeVisible()
    })

    test('should have correct initial card counts for all columns', async ({
      page,
    }) => {
      await expect(page.getByTestId('column-count-backlog')).toHaveText('3')
      await expect(page.getByTestId('column-count-in-progress')).toHaveText('1')
      await expect(page.getByTestId('column-count-review')).toHaveText('1')
      await expect(page.getByTestId('column-count-done')).toHaveText('2')
    })

    test('should render all expected cards', async ({ page }) => {
      const expectedCards = [
        'react',
        'vue',
        'angular',
        'nextjs',
        'typescript',
        'tailwind',
        'prisma',
      ]

      for (const cardId of expectedCards) {
        const card = page.getByTestId(`kanban-card-${cardId}`)
        await expect(card).toBeVisible()
      }
    })
  })

  test.describe('Draggable Attributes', () => {
    test('should have draggable attribute on all cards', async ({ page }) => {
      const cards = [
        'react',
        'vue',
        'angular',
        'nextjs',
        'typescript',
        'tailwind',
        'prisma',
      ]

      for (const cardId of cards) {
        const card = page.getByTestId(`kanban-card-${cardId}`)
        await expect(card).toHaveAttribute('draggable', 'true')
      }
    })

    test('should have cursor-grab style on cards', async ({ page }) => {
      const reactCard = page.getByTestId('kanban-card-react')

      // Check if the card has cursor-grab class
      await expect(reactCard).toHaveClass(/cursor-grab/)
    })
  })

  test.describe('Column Styling', () => {
    test('should have visible borders on columns', async ({ page }) => {
      const backlogColumn = page.getByTestId('kanban-column-backlog')

      // Check for border class
      await expect(backlogColumn).toHaveClass(/border/)
      await expect(backlogColumn).toHaveClass(/border-border/)
    })

    test('should have shadow on columns', async ({ page }) => {
      const backlogColumn = page.getByTestId('kanban-column-backlog')

      // Check for shadow class
      await expect(backlogColumn).toHaveClass(/shadow-sm/)
    })

    test('should have background on columns', async ({ page }) => {
      const backlogColumn = page.getByTestId('kanban-column-backlog')

      // Check for background class
      await expect(backlogColumn).toHaveClass(/bg-muted/)
    })

    test('should have rounded corners on columns', async ({ page }) => {
      const backlogColumn = page.getByTestId('kanban-column-backlog')

      // Check for rounded class
      await expect(backlogColumn).toHaveClass(/rounded-lg/)
    })
  })

  test.describe('Drag and Drop Functionality', () => {
    test('should move card from Backlog to Done column via drag and drop', async ({
      page,
    }) => {
      // Get initial card counts
      const backlogCount = page.getByTestId('column-count-backlog')
      const doneCount = page.getByTestId('column-count-done')

      await expect(backlogCount).toHaveText('3')
      await expect(doneCount).toHaveText('2')

      // Get the react card and done column
      const reactCard = page.getByTestId('kanban-card-react')
      const doneColumn = page.getByTestId('kanban-column-done')

      // Perform drag and drop
      await reactCard.dragTo(doneColumn)

      // Wait for state update
      await page.waitForTimeout(500)

      // Verify card counts updated
      await expect(backlogCount).toHaveText('2')
      await expect(doneCount).toHaveText('3')

      // Verify the card is now in Done column (by checking it's still visible and counts are correct)
      await expect(reactCard).toBeVisible()
    })

    test('should move card from In Progress to Review column', async ({
      page,
    }) => {
      const inProgressCount = page.getByTestId('column-count-in-progress')
      const reviewCount = page.getByTestId('column-count-review')

      await expect(inProgressCount).toHaveText('1')
      await expect(reviewCount).toHaveText('1')

      const nextjsCard = page.getByTestId('kanban-card-nextjs')
      const reviewColumn = page.getByTestId('kanban-column-review')

      // Scroll to ensure the kanban board is visible
      await nextjsCard.scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)

      // Perform drag and drop
      await nextjsCard.dragTo(reviewColumn, { force: true })
      await page.waitForTimeout(500)

      await expect(inProgressCount).toHaveText('0')
      await expect(reviewCount).toHaveText('2')
    })

    test('should move card from Done back to Backlog', async ({ page }) => {
      const backlogCount = page.getByTestId('column-count-backlog')
      const doneCount = page.getByTestId('column-count-done')

      await expect(backlogCount).toHaveText('3')
      await expect(doneCount).toHaveText('2')

      const tailwindCard = page.getByTestId('kanban-card-tailwind')
      const backlogColumn = page.getByTestId('kanban-column-backlog')

      // Scroll to ensure the kanban board is visible
      await tailwindCard.scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)

      // Perform drag and drop
      await tailwindCard.dragTo(backlogColumn, { force: true })
      await page.waitForTimeout(500)

      await expect(backlogCount).toHaveText('4')
      await expect(doneCount).toHaveText('1')
    })

    test('should not change counts when dropping card on same column', async ({
      page,
    }) => {
      const backlogCount = page.getByTestId('column-count-backlog')
      await expect(backlogCount).toHaveText('3')

      const reactCard = page.getByTestId('kanban-card-react')
      const backlogColumn = page.getByTestId('kanban-column-backlog')

      // Drag to same column
      await reactCard.dragTo(backlogColumn)
      await page.waitForTimeout(500)

      // Count should remain the same
      await expect(backlogCount).toHaveText('3')
    })
  })

  test.describe('Visual Feedback During Drag', () => {
    test('should show visual feedback when dragging over column', async ({
      page,
    }) => {
      const reactCard = page.getByTestId('kanban-card-react')
      const doneColumn = page.getByTestId('kanban-column-done')

      // Check that columns have styling classes for visual feedback
      const doneColumnClasses = await doneColumn.getAttribute('class')
      expect(doneColumnClasses).toContain('border')
      expect(doneColumnClasses).toContain('shadow')
      expect(doneColumnClasses).toContain('transition')

      // Verify drag works by performing a drag operation
      const backlogCount = page.getByTestId('column-count-backlog')
      await expect(backlogCount).toHaveText('3')

      await reactCard.dragTo(doneColumn)
      await page.waitForTimeout(500)

      // Verify the card was moved
      await expect(backlogCount).toHaveText('2')
    })
  })

  test.describe('Multiple Drag Operations', () => {
    test('should handle multiple sequential drag operations', async ({
      page,
    }) => {
      // Scroll to ensure the kanban board is visible
      const reactCard = page.getByTestId('kanban-card-react')
      await reactCard.scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)

      // Move react from Backlog to Done
      const doneColumn = page.getByTestId('kanban-column-done')
      await reactCard.dragTo(doneColumn, { force: true })
      await page.waitForTimeout(300)

      // Move vue from Backlog to In Progress
      const vueCard = page.getByTestId('kanban-card-vue')
      const inProgressColumn = page.getByTestId('kanban-column-in-progress')
      await vueCard.dragTo(inProgressColumn, { force: true })
      await page.waitForTimeout(300)

      // Move angular from Backlog to Review
      const angularCard = page.getByTestId('kanban-card-angular')
      const reviewColumn = page.getByTestId('kanban-column-review')
      await angularCard.dragTo(reviewColumn, { force: true })
      await page.waitForTimeout(300)

      // Verify final counts
      await expect(page.getByTestId('column-count-backlog')).toHaveText('0')
      await expect(page.getByTestId('column-count-in-progress')).toHaveText('2')
      await expect(page.getByTestId('column-count-review')).toHaveText('2')
      await expect(page.getByTestId('column-count-done')).toHaveText('3')
    })
  })

  test.describe('Card Content', () => {
    test('should display card names correctly', async ({ page }) => {
      const cardNames = [
        { id: 'react', name: 'react' },
        { id: 'vue', name: 'vue' },
        { id: 'angular', name: 'angular' },
        { id: 'nextjs', name: 'next.js' },
        { id: 'typescript', name: 'typescript' },
        { id: 'tailwind', name: 'tailwind' },
        { id: 'prisma', name: 'prisma' },
      ]

      for (const { id, name } of cardNames) {
        const card = page.getByTestId(`kanban-card-${id}`)
        await expect(card).toContainText(name)
      }
    })

    test('should have drag handle icon on cards', async ({ page }) => {
      // Cards should have the grip vertical icon (SVG) as drag handle
      const reactCard = page.getByTestId('kanban-card-react')
      const gripIcon = reactCard.locator('svg')
      await expect(gripIcon).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should maintain focus order for keyboard users', async ({ page }) => {
      // Tab through the page to verify interactive elements receive focus
      await page.keyboard.press('Tab')

      // Continue tabbing to check that focus moves through the page
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
      }

      // Verify that some interactive element has focus
      // Using first() to handle multiple focused elements (e.g., nested focus)
      const focusedElement = page.locator(':focus').first()
      await expect(focusedElement).toBeVisible()
    })

    test('should have accessible column labels', async ({ page }) => {
      // Each column should have visible title text
      const columnTitles = ['Backlog', 'In Progress', 'Review', 'Done']

      for (const title of columnTitles) {
        const columnTitle = page.getByText(title, { exact: true }).first()
        await expect(columnTitle).toBeVisible()
      }
    })
  })
})
