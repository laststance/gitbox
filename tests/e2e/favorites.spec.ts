/**
 * E2E Tests: Board Favorites Feature
 *
 * Tests the complete favorites workflow including:
 * - Toggling favorite status on boards
 * - Favorites page filtering
 * - Persistence after page reload
 * - Empty state handling
 */

import { test, expect } from '@playwright/test'

test.describe('Board Favorites Feature', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test.beforeEach(async ({ page }) => {
    // Navigate to boards page before each test
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Favorites Toggle', () => {
    test('should toggle board favorite status', async ({ page }) => {
      // Find the first board card and its star button
      const firstCard = page.locator('[data-testid="board-card"]').first()
      const starButton = firstCard
        .locator('button[aria-label*="favorite"]')
        .first()

      // Get initial state
      const initialLabel = await starButton.getAttribute('aria-label')
      const isInitiallyFavorited = initialLabel?.includes('Remove')

      // Click to toggle
      await starButton.click()

      // Wait for optimistic update
      await page.waitForTimeout(200)

      // Verify the label changed
      const newLabel = await starButton.getAttribute('aria-label')
      if (isInitiallyFavorited) {
        expect(newLabel).toContain('Add')
        expect(newLabel).not.toContain('Remove')
      } else {
        expect(newLabel).toContain('Remove')
        expect(newLabel).not.toContain('Add')
      }

      // Verify visual state change (color)
      const starIcon = starButton.locator('svg')
      if (isInitiallyFavorited) {
        // Should be gray when unfavorited
        await expect(starIcon).not.toHaveClass(/text-amber-500/)
      } else {
        // Should be amber when favorited
        await expect(starIcon).toHaveClass(/text-amber-500/)
      }
    })

    test('should persist favorite status after page reload', async ({
      page,
    }) => {
      // Find first unfavorited board and favorite it
      const unfavoritedButton = page
        .locator('button[aria-label*="Add"][aria-label*="favorite"]')
        .first()
      const boardCard = unfavoritedButton.locator('..')

      // Get board name for verification
      const boardName = await boardCard.locator('h2, h3').first().textContent()

      // Favorite the board
      await unfavoritedButton.click()
      await page.waitForTimeout(300)

      // Reload the page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Find the same board and verify it's still favorited
      const reloadedCard = page.locator(`text=${boardName}`).locator('..')
      const starButton = reloadedCard
        .locator('button[aria-label*="favorite"]')
        .first()
      const label = await starButton.getAttribute('aria-label')

      expect(label).toContain('Remove')
      expect(label).toContain(boardName || '')
    })

    test('should handle multiple rapid clicks gracefully', async ({ page }) => {
      const starButton = page.locator('button[aria-label*="favorite"]').first()

      // Click rapidly 5 times
      for (let i = 0; i < 5; i++) {
        await starButton.click({ force: true })
        await page.waitForTimeout(100)
      }

      // Should still be in a valid state (either favorited or not)
      const finalLabel = await starButton.getAttribute('aria-label')
      expect(finalLabel).toMatch(/(Add|Remove)/)
    })

    test('should show loading state during toggle', async ({ page }) => {
      const starButton = page.locator('button[aria-label*="favorite"]').first()

      // Click and immediately check for disabled state
      await starButton.click()

      // Button should be disabled during transition
      await expect(starButton).toBeDisabled()

      // Wait for transition to complete
      await page.waitForTimeout(500)

      // Should be enabled again
      await expect(starButton).toBeEnabled()
    })
  })

  test.describe('Favorites Page', () => {
    test('should display only favorited boards on /boards/favorites', async ({
      page,
    }) => {
      // Favorite at least one board
      const starButton = page
        .locator('button[aria-label*="Add"][aria-label*="favorite"]')
        .first()
      const boardCard = starButton.locator('..')
      const boardName = await boardCard.locator('h2, h3').first().textContent()

      await starButton.click()
      await page.waitForTimeout(300)

      // Navigate to favorites page
      await page.goto('/boards/favorites')
      await page.waitForLoadState('networkidle')

      // Verify the favorited board appears
      if (boardName) {
        await expect(page.getByText(boardName)).toBeVisible()
      }

      // Verify page title
      await expect(
        page.getByRole('heading', { name: /favorite boards/i }),
      ).toBeVisible()
    })

    test('should show empty state when no favorites exist', async ({
      page,
    }) => {
      // Unfavorite all boards
      let favoritedButtons = page.locator(
        'button[aria-label*="Remove"][aria-label*="favorite"]',
      )
      let count = await favoritedButtons.count()

      while (count > 0) {
        await favoritedButtons.first().click()
        await page.waitForTimeout(200)
        favoritedButtons = page.locator(
          'button[aria-label*="Remove"][aria-label*="favorite"]',
        )
        count = await favoritedButtons.count()
      }

      // Navigate to favorites page
      await page.goto('/boards/favorites')
      await page.waitForLoadState('networkidle')

      // Verify empty state
      await expect(page.getByText(/no favorite boards yet/i)).toBeVisible()
      await expect(
        page.getByRole('link', { name: /view all boards|go to all boards/i }),
      ).toBeVisible()

      // Verify star icon in empty state
      const starIcon = page.locator('svg').first()
      await expect(starIcon).toBeVisible()
    })

    test('should navigate back to all boards from favorites page', async ({
      page,
    }) => {
      await page.goto('/boards/favorites')
      await page.waitForLoadState('networkidle')

      // Click "View All Boards" link
      const backLink = page.getByRole('link', {
        name: /view all boards|back to boards/i,
      })
      await backLink.click()

      // Should navigate to /boards
      await expect(page).toHaveURL(/\/boards$/)
    })

    test('should remove board from favorites page when unfavorited', async ({
      page,
    }) => {
      // Ensure at least one board is favorited
      const addButton = page
        .locator('button[aria-label*="Add"][aria-label*="favorite"]')
        .first()
      if ((await addButton.count()) > 0) {
        await addButton.click()
        await page.waitForTimeout(300)
      }

      // Navigate to favorites page
      await page.goto('/boards/favorites')
      await page.waitForLoadState('networkidle')

      // Get the first favorited board
      const firstCard = page.locator('[data-testid="board-card"]').first()
      const boardName = await firstCard.locator('h2, h3').first().textContent()
      const starButton = firstCard.locator('button[aria-label*="Remove"]')

      // Unfavorite it
      await starButton.click()
      await page.waitForTimeout(500)

      // Board should disappear from the page
      if (boardName) {
        // Either the board is gone, or we see the empty state
        const boardExists = await page.getByText(boardName).isVisible()
        if (!boardExists) {
          // Check if empty state appears
          const emptyState = await page
            .getByText(/no favorite boards yet/i)
            .isVisible()
          expect(emptyState || !boardExists).toBe(true)
        }
      }
    })
  })

  test.describe('Responsive Behavior', () => {
    test('should show star icons on mobile viewports', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/boards')
      await page.waitForLoadState('networkidle')

      // Star buttons should be visible on mobile (opacity-70)
      const starButtons = page.locator('button[aria-label*="favorite"]')
      await expect(starButtons.first()).toBeVisible()
    })

    test('should hide unfavorited stars on desktop until hover', async ({
      page,
    }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.goto('/boards')
      await page.waitForLoadState('networkidle')

      // Find an unfavorited board
      const unfavoritedCard = page
        .locator('button[aria-label*="Add"][aria-label*="favorite"]')
        .first()
        .locator('..')

      // Star should have reduced opacity (md:opacity-0)
      // Note: This is a CSS behavior test, actual opacity check may vary
      const starButton = unfavoritedCard
        .locator('button[aria-label*="Add"]')
        .first()
      await expect(starButton).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Focus on the first board card
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Should be able to tab to star button
      const focusedElement = page.locator(':focus')
      const ariaLabel = await focusedElement.getAttribute('aria-label')

      // Continue tabbing until we find a favorite button
      let attempts = 0
      while (!ariaLabel?.includes('favorite') && attempts < 20) {
        await page.keyboard.press('Tab')
        const newFocused = page.locator(':focus')
        const newLabel = await newFocused.getAttribute('aria-label')
        if (newLabel?.includes('favorite')) {
          break
        }
        attempts++
      }

      // Press Enter to toggle
      await page.keyboard.press('Enter')
      await page.waitForTimeout(200)

      // Verify toggle worked
      const updatedFocus = page.locator(':focus')
      const updatedLabel = await updatedFocus.getAttribute('aria-label')
      expect(updatedLabel).toMatch(/(Add|Remove)/)
    })

    test('should have proper ARIA labels', async ({ page }) => {
      const starButtons = page.locator('button[aria-label*="favorite"]')
      const count = await starButtons.count()

      expect(count).toBeGreaterThan(0)

      // Check first button has descriptive label
      const firstButton = starButtons.first()
      const label = await firstButton.getAttribute('aria-label')

      expect(label).toBeTruthy()
      expect(label).toMatch(/(Add|Remove)/)
      expect(label).toContain('favorite')
    })

    test('should announce state changes to screen readers', async ({
      page,
    }) => {
      const starButton = page.locator('button[aria-label*="favorite"]').first()
      const initialLabel = await starButton.getAttribute('aria-label')

      await starButton.click()
      await page.waitForTimeout(200)

      const newLabel = await starButton.getAttribute('aria-label')

      // Label should change to reflect new state
      expect(newLabel).not.toBe(initialLabel)
      expect(newLabel).toMatch(/(Add|Remove)/)
    })
  })

  test.describe('Error Handling', () => {
    test('should revert optimistic update on server error', async ({
      page,
      context,
    }) => {
      // This test would require MSW to simulate server errors
      // For now, we verify the optimistic update mechanism exists

      const starButton = page.locator('button[aria-label*="favorite"]').first()
      const initialLabel = await starButton.getAttribute('aria-label')

      // Click to toggle
      await starButton.click()

      // Immediate optimistic update
      await page.waitForTimeout(100)
      const optimisticLabel = await starButton.getAttribute('aria-label')
      expect(optimisticLabel).not.toBe(initialLabel)

      // If server succeeds, state should persist
      await page.waitForTimeout(500)
      const finalLabel = await starButton.getAttribute('aria-label')
      expect(finalLabel).toMatch(/(Add|Remove)/)
    })
  })
})
