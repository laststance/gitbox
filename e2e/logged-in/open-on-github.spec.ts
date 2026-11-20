/**
 * Open on GitHub E2E Tests
 *
 * The card overflow menu's "Open on GitHub" must open the repository's
 * GitHub page in a new tab. It used to call window.open, which popup-blocker
 * scriptlets (AdGuard's prevent-window-open and friends) turn into a silent
 * no-op, so the menu item did nothing. It is now a real link.
 *
 * Requires authentication (uses storageState from auth.setup.ts)
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS, CARD_IDS } from '../helpers/db-query'

test.describe('Open on GitHub', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test('opens the card repository on GitHub in a new tab', async ({
    page,
    context,
  }) => {
    // Arrange: the new tab would hit github.com for real — stub the answer so
    // the test stays offline. card1 is seeded as testuser/test-repo.
    await context.route('**/github.com/testuser/test-repo', (route) =>
      route.fulfill({ status: 200, body: '<html><title>repo</title></html>' }),
    )
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    const trigger = page.getByTestId(`overflow-menu-trigger-${CARD_IDS.card1}`)
    await expect(trigger).toBeVisible({ timeout: 10000 })
    await trigger.click()

    // Act
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByTestId(`open-github-${CARD_IDS.card1}`).click(),
    ])

    // Assert
    await expect(popup).toHaveURL('https://github.com/testuser/test-repo')
  })
})
