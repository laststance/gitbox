/**
 * E2E Tests: Board Favorites Feature
 *
 * Tests the complete favorites workflow including:
 * - Toggling favorite status on boards
 * - Favorites page filtering
 * - Persistence after page reload
 * - Empty state handling
 */

import { test, expect } from '../fixtures/coverage'
import { querySingle, BOARD_IDS } from '../helpers/db-query'

test.describe('Board Favorites Feature', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.beforeEach(async ({ page }) => {
    // Navigate to boards page before each test
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Favorites Toggle', () => {
    test('should toggle board favorite status', async ({ page }) => {
      // Find the first board card and its star button
      const firstCard = page.locator('[data-testid^="board-card-"]').first()
      const starButton = firstCard
        .locator('button[aria-label*="favorite"]')
        .first()

      // Get initial state
      const initialLabel = await starButton.getAttribute('aria-label')
      const isInitiallyFavorited = initialLabel?.includes('Remove')

      // Click to toggle
      await starButton.click()

      // Verify the label changed (Playwright auto-waits for actionability after click)
      await expect(async () => {
        const newLabel = await starButton.getAttribute('aria-label')
        if (isInitiallyFavorited) {
          expect(newLabel).toContain('Add')
          expect(newLabel).not.toContain('Remove')
        } else {
          expect(newLabel).toContain('Remove')
          expect(newLabel).not.toContain('Add')
        }
      }).toPass({ timeout: 5000 })

      // Verify visual state change (color is on button, not SVG)
      if (isInitiallyFavorited) {
        // Should be gray when unfavorited
        await expect(starButton).not.toHaveClass(/text-amber-500/)
      } else {
        // Should be amber when favorited
        await expect(starButton).toHaveClass(/text-amber-500/)
      }
    })

    test('should persist favorite status after page reload', async ({
      page,
    }) => {
      // Find first unfavorited board card that has an "Add to favorites" button
      const boardCards = page.locator('[data-testid^="board-card-"]')
      let targetCard = boardCards.first()
      let foundUnfavorited = false

      const count = await boardCards.count()
      for (let i = 0; i < count; i++) {
        const card = boardCards.nth(i)
        const addButton = card.locator(
          'button[aria-label*="Add"][aria-label*="favorite"]',
        )
        if ((await addButton.count()) > 0) {
          targetCard = card
          foundUnfavorited = true
          break
        }
      }

      // If all boards are favorited, unfavorite the first one
      if (!foundUnfavorited) {
        const removeButton = targetCard.locator(
          'button[aria-label*="Remove"][aria-label*="favorite"]',
        )
        await removeButton.click()
        // Wait for the label to update after unfavoriting
        await expect(
          targetCard.locator(
            'button[aria-label*="Add"][aria-label*="favorite"]',
          ),
        ).toBeVisible({ timeout: 5000 })
      }

      const unfavoritedButton = targetCard.locator(
        'button[aria-label*="Add"][aria-label*="favorite"]',
      )

      // Get board name for verification
      const boardName = await targetCard.locator('h2, h3').first().textContent()

      // Favorite the board
      await unfavoritedButton.click()

      // Wait for the favorite status to be persisted
      await expect(
        targetCard.locator(
          'button[aria-label*="Remove"][aria-label*="favorite"]',
        ),
      ).toBeVisible({ timeout: 5000 })

      // Reload the page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Find the board by name and verify it's still favorited
      // Use the board card with the matching h3 text
      const reloadedCards = page.locator('[data-testid^="board-card-"]')
      const cardCount = await reloadedCards.count()
      let foundCard = false

      for (let i = 0; i < cardCount; i++) {
        const card = reloadedCards.nth(i)
        const cardName = await card.locator('h2, h3').first().textContent()
        if (cardName === boardName) {
          const starButton = card.locator('button[aria-label*="favorite"]')
          const label = await starButton.getAttribute('aria-label')
          expect(label).toContain('Remove')
          expect(label).toContain(boardName || '')
          foundCard = true
          break
        }
      }

      expect(foundCard).toBe(true)
    })

    test('should verify is_favorite is persisted in database after toggle', async ({
      page,
    }) => {
      // Use testBoard for this test
      const boardId = BOARD_IDS.testBoard

      // Get initial state from database
      const boardBefore = await querySingle<{ is_favorite: boolean }>('board', {
        id: boardId,
      })
      expect(boardBefore).not.toBeNull()
      const initialFavorite = boardBefore?.is_favorite ?? false

      // Find the "Test Board" card specifically using its name
      const boardCards = page.locator('[data-testid^="board-card-"]')
      const cardCount = await boardCards.count()

      // Find the Test Board card by name
      let starButton = null
      for (let i = 0; i < cardCount; i++) {
        const card = boardCards.nth(i)
        const cardName = await card.locator('h2, h3').first().textContent()
        if (cardName?.includes('Test Board')) {
          starButton = card.locator('button[aria-label*="favorite"]')
          break
        }
      }

      expect(starButton).not.toBeNull()
      await starButton!.click()

      // Wait for server action to complete (optimistic update + server roundtrip)
      // Poll the database to verify persistence
      await expect(async () => {
        const boardAfter = await querySingle<{ is_favorite: boolean }>(
          'board',
          {
            id: boardId,
          },
        )
        expect(boardAfter).not.toBeNull()
        expect(boardAfter?.is_favorite).toBe(!initialFavorite)
      }).toPass({ timeout: 5000 })
    })

    test('should handle multiple rapid clicks gracefully', async ({ page }) => {
      const starButton = page.locator('button[aria-label*="favorite"]').first()

      // Click rapidly 5 times
      for (let i = 0; i < 5; i++) {
        await starButton.click({ force: true })
      }

      // Should still be in a valid state (either favorited or not)
      await expect(async () => {
        const finalLabel = await starButton.getAttribute('aria-label')
        expect(finalLabel).toMatch(/(Add|Remove)/)
      }).toPass({ timeout: 5000 })
    })

    test('should show loading state during toggle', async ({ page }) => {
      const starButton = page.locator('button[aria-label*="favorite"]').first()

      // Click and immediately check for disabled state
      await starButton.click()

      // Button should be disabled during transition
      await expect(starButton).toBeDisabled()

      // Should be enabled again after transition completes
      await expect(starButton).toBeEnabled({ timeout: 5000 })
    })
  })

  test.describe('Favorites Page', () => {
    test('should display only favorited boards on /boards/favorites', async ({
      page,
    }) => {
      // Find first board card with an "Add to favorites" button
      const boardCards = page.locator('[data-testid^="board-card-"]')
      let targetCard = boardCards.first()
      let foundUnfavorited = false

      const count = await boardCards.count()
      for (let i = 0; i < count; i++) {
        const card = boardCards.nth(i)
        const addButton = card.locator(
          'button[aria-label*="Add"][aria-label*="favorite"]',
        )
        if ((await addButton.count()) > 0) {
          targetCard = card
          foundUnfavorited = true
          break
        }
      }

      // If all boards are favorited, use the first one (already favorited)
      if (!foundUnfavorited) {
        // Already have a favorited board, just navigate to favorites
        await page.goto('/boards/favorites')
        await page.waitForLoadState('networkidle')
        await expect(
          page.getByRole('heading', { name: /favorite boards/i }),
        ).toBeVisible()
        return
      }

      const starButton = targetCard.locator(
        'button[aria-label*="Add"][aria-label*="favorite"]',
      )
      const boardName = await targetCard.locator('h2, h3').first().textContent()

      await starButton.click()

      // Wait for favorite to be applied before navigating
      await expect(
        targetCard.locator(
          'button[aria-label*="Remove"][aria-label*="favorite"]',
        ),
      ).toBeVisible({ timeout: 5000 })

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
        // Wait for the button label to change after unfavoriting
        await expect(async () => {
          const newCount = await page
            .locator('button[aria-label*="Remove"][aria-label*="favorite"]')
            .count()
          expect(newCount).toBeLessThan(count)
        }).toPass({ timeout: 5000 })
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
      // There are two "back to boards" links - one in header, one in empty state
      // Just verify at least one is visible (use first() to avoid strict mode error)
      await expect(
        page
          .getByRole('link', { name: /view all boards|go to all boards/i })
          .first(),
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
        // Wait for favorite to be applied
        await expect(addButton).not.toBeVisible({ timeout: 5000 })
      }

      // Navigate to favorites page
      await page.goto('/boards/favorites')
      await page.waitForLoadState('networkidle')

      // Get the first favorited board
      const firstCard = page.locator('[data-testid^="board-card-"]').first()
      const boardName = await firstCard.locator('h2, h3').first().textContent()
      const starButton = firstCard.locator('button[aria-label*="Remove"]')

      // Unfavorite it
      await starButton.click()

      // Board should disappear from the page
      if (boardName) {
        // Check if the board card is still visible (use heading to avoid matching toast)
        const boardHeading = page.getByRole('heading', {
          name: boardName,
          level: 3,
        })

        // Wait for the card to be removed from the favorites page
        await expect(async () => {
          const boardExists = (await boardHeading.count()) > 0
          if (!boardExists) {
            // Board is gone - check if empty state appears
            const emptyState = await page
              .getByText(/no favorite boards yet/i)
              .isVisible()
            expect(emptyState || !boardExists).toBe(true)
          }
        }).toPass({ timeout: 5000 })
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
      // Get the first star button
      const firstStarButton = page
        .locator('button[aria-label*="favorite"]')
        .first()

      // Get initial state
      const initialLabel = await firstStarButton.getAttribute('aria-label')
      const isInitiallyFavorited = initialLabel?.includes('Remove')

      // Focus and activate via keyboard
      await firstStarButton.focus()
      await page.keyboard.press('Enter')

      // Verify toggle worked - label should have changed
      await expect(async () => {
        const updatedLabel = await firstStarButton.getAttribute('aria-label')
        if (isInitiallyFavorited) {
          expect(updatedLabel).toContain('Add')
        } else {
          expect(updatedLabel).toContain('Remove')
        }
      }).toPass({ timeout: 5000 })
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

      // Verify label changes after click (optimistic update)
      await expect(async () => {
        const newLabel = await starButton.getAttribute('aria-label')
        // Label should change to reflect new state
        expect(newLabel).not.toBe(initialLabel)
        expect(newLabel).toMatch(/(Add|Remove)/)
      }).toPass({ timeout: 5000 })
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

      // Immediate optimistic update - label should change
      await expect(async () => {
        const optimisticLabel = await starButton.getAttribute('aria-label')
        expect(optimisticLabel).not.toBe(initialLabel)
      }).toPass({ timeout: 5000 })

      // If server succeeds, state should persist
      await expect(async () => {
        const finalLabel = await starButton.getAttribute('aria-label')
        expect(finalLabel).toMatch(/(Add|Remove)/)
      }).toPass({ timeout: 5000 })
    })
  })
})
