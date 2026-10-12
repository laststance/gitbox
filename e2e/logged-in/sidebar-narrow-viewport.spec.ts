/**
 * Sidebar Below 768px E2E Tests
 *
 * On a phone the sidebar is an icon rail of 64px at the left edge, and the
 * page lies beside it. Its toggle opens the full sidebar over the page: the
 * page keeps its place and its width, a backdrop covers it and it is out of
 * reach, and the sidebar closes again from the backdrop, from Escape and from
 * one of its links.
 *
 * The unit tests of the sidebar check its states and class names. Only a
 * browser lays the page out, so these tests measure where things are.
 *
 * @see src/tests/unit/components/Sidebar/Sidebar.narrow-viewport.test.tsx
 */

import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/coverage'

/** A phone held upright: below the 768px where the sidebar leaves the page. */
const PHONE_VIEWPORT = { width: 375, height: 812 }

/**
 * Left edge and width of an element, in whole pixels.
 * @param element - The element to measure.
 * @returns Its `left` and `width`, or `null` while it is not laid out.
 */
async function measureHorizontally(
  element: Locator,
): Promise<{ left: number; width: number } | null> {
  const box = await element.boundingBox()
  return box ? { left: Math.round(box.x), width: Math.round(box.width) } : null
}

/**
 * Opens the boards list and waits until the sidebar has become the rail the
 * client renders (its toggle is not in the server's markup).
 * @param page - The page of the test.
 * @returns The sidebar, the page content and the toggle that opens the sidebar.
 */
async function openBoardsWithRail(
  page: Page,
): Promise<{ sidebar: Locator; content: Locator; expandButton: Locator }> {
  await page.goto('/boards')
  const sidebar = page.locator('aside')
  const expandButton = page.getByRole('button', { name: 'Expand sidebar' })
  await expect(expandButton).toBeVisible()
  await expect
    .poll(async () => (await measureHorizontally(sidebar))?.width)
    .toBe(64)
  return { sidebar, content: page.locator('main'), expandButton }
}

test.describe('Sidebar below 768px', () => {
  test.use({ storageState: 'e2e/.auth/user.json', viewport: PHONE_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    // The stored choice of a wide screen must not decide these tests
    await page.addInitScript(() => {
      if (sessionStorage.getItem('gitbox-e2e-storage-cleared')) return

      localStorage.removeItem('gitbox-state')
      sessionStorage.setItem('gitbox-e2e-storage-cleared', 'true')
    })
  })

  test('shows an icon rail at the left edge with the page beside it', async ({
    page,
  }) => {
    // Arrange & Act
    const { sidebar, content } = await openBoardsWithRail(page)

    // Assert: a rail of 64px (w-16), and the page fills the 311px beside it
    expect(await measureHorizontally(sidebar)).toEqual({ left: 0, width: 64 })
    expect(await measureHorizontally(content)).toEqual({ left: 64, width: 311 })
    await expect(page.getByTestId('sidebar-backdrop')).toHaveCount(0)
    await expect(content).not.toHaveAttribute('inert')
  })

  test('opens over the page: the page keeps its place and its width, and nothing scrolls sideways', async ({
    page,
  }) => {
    // Arrange
    const { sidebar, content, expandButton } = await openBoardsWithRail(page)

    // Act
    await expandButton.click()

    // Assert: the sidebar has its full width (w-64) and its labels ...
    await expect
      .poll(async () => (await measureHorizontally(sidebar))?.width)
      .toBe(256)
    await expect(sidebar.getByText('All Boards')).toBeVisible()
    await expect(page.getByTestId('sidebar-backdrop')).toBeVisible()
    // ... and the page under it is where it was, out of reach of the
    // keyboard and of a screen reader
    expect(await measureHorizontally(content)).toEqual({ left: 64, width: 311 })
    await expect(content).toHaveAttribute('inert')
    const pageWidthPx = await page.evaluate(
      () => document.documentElement.scrollWidth,
    )
    expect(pageWidthPx).toBe(375)
  })

  // Value: protects=the sidebar opens over the page as one clean edge that uncovers its labels; fails_when=a label wraps while the sidebar is still narrow, or the header draws its toggle beyond the edge that is still moving; why_new=the other tests look at the sidebar when the opening has ended; seam=none; no_claim=how the motion looks frame by frame (that is checked on a recording)
  test('while it opens, no label breaks onto a second line and nothing is drawn beyond its moving edge', async ({
    page,
  }) => {
    // Arrange: the opening takes 100s instead of 0.3s, so the test looks at
    // its first moments, when the labels are laid out and the sidebar has
    // hardly grown
    const { sidebar, expandButton } = await openBoardsWithRail(page)
    await page.addStyleTag({
      content: 'aside { transition-duration: 100s !important; }',
    })

    // Act
    await expandButton.click()
    const allBoardsLink = sidebar.getByRole('link', { name: 'All Boards' })
    await expect(allBoardsLink).toBeAttached()
    const widthWhileOpeningPx = (await measureHorizontally(sidebar))?.width
    const linkHeightWhileOpeningPx = (await allBoardsLink.boundingBox())?.height
    const testIdBeyondTheEdge = await page.evaluate(() =>
      // A point in the row of the logo, right of a sidebar of under 100px
      document.elementFromPoint(120, 28)?.getAttribute('data-testid'),
    )

    // Assert: still narrow, "All Boards" is one line (20px of text and 8px
    // above and below it), and right of the edge lies the backdrop
    expect(widthWhileOpeningPx).toBeLessThan(100)
    expect(linkHeightWhileOpeningPx).toBe(36)
    expect(testIdBeyondTheEdge).toBe('sidebar-backdrop')

    // Act: the opening ends
    await sidebar.evaluate((aside) =>
      aside.getAnimations().forEach((animation) => animation.finish()),
    )

    // Assert: the line has the height it had on the way
    await expect
      .poll(async () => (await measureHorizontally(sidebar))?.width)
      .toBe(256)
    expect((await allBoardsLink.boundingBox())?.height).toBe(36)
  })

  test('closes when the page behind it is pressed, and the page is within reach again', async ({
    page,
  }) => {
    // Arrange
    const { sidebar, content, expandButton } = await openBoardsWithRail(page)
    await expandButton.click()
    const backdrop = page.getByTestId('sidebar-backdrop')
    await expect(backdrop).toBeVisible()

    // Act: a point of the page right of the opened sidebar
    await backdrop.click({ position: { x: 330, y: 400 } })

    // Assert
    await expect(backdrop).toHaveCount(0)
    await expect(content).not.toHaveAttribute('inert')
    await expect
      .poll(async () => (await measureHorizontally(sidebar))?.width)
      .toBe(64)
  })

  test('closes on Escape and gives the keyboard focus back to its toggle', async ({
    page,
  }) => {
    // Arrange
    const { sidebar, expandButton } = await openBoardsWithRail(page)
    await expandButton.click()
    await expect(
      page.getByRole('button', { name: 'Collapse sidebar' }),
    ).toBeFocused()

    // Act
    await page.keyboard.press('Escape')

    // Assert
    await expect(page.getByTestId('sidebar-backdrop')).toHaveCount(0)
    await expect(expandButton).toBeFocused()
    await expect
      .poll(async () => (await measureHorizontally(sidebar))?.width)
      .toBe(64)
  })

  test('Escape in the theme list closes the list and leaves the sidebar open; the next Escape closes the sidebar', async ({
    page,
  }) => {
    // Arrange: the theme list is drawn outside of the sidebar
    const { sidebar, expandButton } = await openBoardsWithRail(page)
    await expandButton.click()
    await sidebar.locator('button:has-text("Theme")').click()
    const themeList = page.getByRole('menu')
    await expect(themeList).toBeVisible()

    // Act
    await page.keyboard.press('Escape')

    // Assert: the list is gone, the sidebar still lies over the page
    await expect(themeList).toHaveCount(0)
    await expect(page.getByTestId('sidebar-backdrop')).toBeVisible()
    await expect(sidebar.getByText('All Boards')).toBeVisible()

    // Act
    await page.keyboard.press('Escape')

    // Assert
    await expect(page.getByTestId('sidebar-backdrop')).toHaveCount(0)
    await expect
      .poll(async () => (await measureHorizontally(sidebar))?.width)
      .toBe(64)
  })

  test('a link of the opened sidebar opens its page and closes the sidebar', async ({
    page,
  }) => {
    // Arrange
    const { sidebar, expandButton } = await openBoardsWithRail(page)
    await expandButton.click()
    await expect(page.getByTestId('sidebar-backdrop')).toBeVisible()

    // Act: Favorites shares the layout of the boards list, so the sidebar
    // is the same one before and after
    await sidebar.getByRole('link', { name: 'Favorites' }).click()

    // Assert
    await expect(page).toHaveURL(/\/boards\/favorites$/)
    await expect(page.getByTestId('sidebar-backdrop')).toHaveCount(0)
    await expect
      .poll(async () => (await measureHorizontally(sidebar))?.width)
      .toBe(64)
  })
})
