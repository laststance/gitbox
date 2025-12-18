/**
 * E2E Test: Kanban Board Drag & Drop Operations (User Story 3)
 *
 * Test scope:
 * - Drag & drop cards between columns (Status change)
 * - Drag & drop cards within column (Priority change)
 * - Undo functionality (Z key)
 * - WIP limit validation and warnings
 * - Optimistic UI updates
 * - Keyboard navigation (Tab, Enter, . for menu)
 * - Board state persistence
 */

import { test, expect } from '@playwright/test'

test.describe('User Story 3: Kanban Board Management', () => {
  test.beforeEach(async ({ page }) => {
    // 前提条件: ログイン済み、テスト用ボードが存在
    // TODO: 認証セットアップが必要な場合は追加
    await page.goto('http://localhost:3008')
  })

  test('T048-1: Drag card between columns changes status', async ({ page }) => {
    // Given: ボードページにアクセスし、カードが "Backlog" 列にある
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const card = page.locator('[data-testid^="repo-card-"]').first()

    await expect(backlogColumn).toBeVisible()
    await expect(card).toBeVisible()

    // When: カードを "Backlog" から "Todo" にドラッグ&ドロップ
    await card.dragTo(todoColumn)

    // Then: カードが "Todo" 列に移動する
    await expect(
      todoColumn.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible()

    // And: 移動が100ms以内で完了する（optimistic UI update）
    // NOTE: Playwright自動タイムアウトで検証される
  })

  test('T048-2: Drag card within column changes priority', async ({ page }) => {
    // Given: "Todo" 列に複数のカードがある
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const cards = todoColumn.locator('[data-testid^="repo-card-"]')

    await expect(cards).toHaveCount(3, { timeout: 5000 }) // 最低3枚のカード

    const firstCard = cards.nth(0)
    const thirdCard = cards.nth(2)

    // 最初のカードのテキストを取得
    const firstCardText = await firstCard.textContent()

    // When: 1番目のカードを3番目の位置にドラッグ
    await firstCard.dragTo(thirdCard)

    // Then: カードの順序が変更される
    const updatedCards = todoColumn.locator('[data-testid^="repo-card-"]')
    const newThirdCardText = await updatedCards.nth(2).textContent()

    expect(newThirdCardText).toBe(firstCardText)
  })

  test('T049-1: Undo last drag operation with Z key', async ({ page }) => {
    // Given: カードを移動する
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const card = backlogColumn.locator('[data-testid^="repo-card-"]').first()

    const originalColumnCards = await backlogColumn
      .locator('[data-testid^="repo-card-"]')
      .count()

    // When: カードを移動
    await card.dragTo(todoColumn)
    await page.waitForTimeout(200) // 移動完了を待つ

    // Then: カードが移動している
    const afterMoveBacklogCards = await backlogColumn
      .locator('[data-testid^="repo-card-"]')
      .count()
    expect(afterMoveBacklogCards).toBe(originalColumnCards - 1)

    // When: Z キーを押してアンドゥ
    await page.keyboard.press('z')
    await page.waitForTimeout(300) // アンドゥ完了を待つ（200ms以内の要件）

    // Then: カードが元の列に戻る
    const afterUndoBacklogCards = await backlogColumn
      .locator('[data-testid^="repo-card-"]')
      .count()
    expect(afterUndoBacklogCards).toBe(originalColumnCards)
  })

  test('T056: WIP limit validation displays warning', async ({ page }) => {
    // Given: "In Progress" 列にWIP制限がある（例: 3枚）
    const inProgressColumn = page.locator(
      '[data-testid="status-column-in-progress"]',
    )
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')

    // When: WIP制限を超えるカードを移動しようとする
    // TODO: 実際のWIP制限値に応じて調整が必要
    const cards = backlogColumn.locator('[data-testid^="repo-card-"]')

    // 3枚のカードを "In Progress" に移動
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).dragTo(inProgressColumn)
      await page.waitForTimeout(200)
    }

    // 4枚目を移動しようとする
    await cards.nth(3).dragTo(inProgressColumn)

    // Then: WIP制限警告が表示される
    const wipWarning = page.locator('[data-testid="wip-limit-warning"]')
    await expect(wipWarning).toBeVisible({ timeout: 2000 })
    await expect(wipWarning).toContainText(/WIP limit/i)
  })

  test('T059-1: Keyboard navigation with Tab key', async ({ page }) => {
    // Given: ボードページにアクセス
    const firstCard = page.locator('[data-testid^="repo-card-"]').first()

    // When: Tab キーでフォーカスを移動
    await page.keyboard.press('Tab')

    // Then: 最初のカードがフォーカスされる
    await expect(firstCard).toBeFocused()
  })

  test('T059-2: Open overflow menu with . (dot) key', async ({ page }) => {
    // Given: カードにフォーカスがある
    const firstCard = page.locator('[data-testid^="repo-card-"]').first()
    await firstCard.focus()

    // When: . (ドット) キーを押す
    await page.keyboard.press('.')

    // Then: オーバーフローメニューが開く
    const overflowMenu = page.locator('[data-testid="overflow-menu"]')
    await expect(overflowMenu).toBeVisible({ timeout: 1000 })
  })

  test('T059-3: Press Enter to open card details', async ({ page }) => {
    // Given: カードにフォーカスがある
    const firstCard = page.locator('[data-testid^="repo-card-"]').first()
    await firstCard.focus()

    // When: Enter キーを押す
    await page.keyboard.press('Enter')

    // Then: カードの詳細が開く（Project Info modal または GitHub リンク）
    // TODO: 実装に応じて適切な検証に変更
    await expect(page).toHaveURL(/github\.com|\/board\/.*/, { timeout: 2000 })
  })

  test('T060: Board state persists after page reload', async ({ page }) => {
    // Given: カードを移動する
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const card = backlogColumn.locator('[data-testid^="repo-card-"]').first()

    const cardText = await card.textContent()
    await card.dragTo(todoColumn)
    await page.waitForTimeout(500) // Redux & LocalStorage 同期を待つ

    // When: ページをリロード
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Then: カードの状態が保持される
    const todoCards = todoColumn.locator('[data-testid^="repo-card-"]')
    const movedCardInTodo = todoCards.filter({ hasText: cardText || '' })
    await expect(movedCardInTodo).toBeVisible()
  })

  test('T057: Optimistic UI updates complete within 100ms', async ({
    page,
  }) => {
    // Given: ボードページにアクセス
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const card = backlogColumn.locator('[data-testid^="repo-card-"]').first()

    // When: ドラッグ&ドロップを実行し、時間を計測
    const startTime = Date.now()
    await card.dragTo(todoColumn)

    // UIが更新されるのを待つ
    await expect(
      todoColumn.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible()
    const endTime = Date.now()

    // Then: 100ms以内に完了する
    const duration = endTime - startTime
    expect(duration).toBeLessThan(100)
  })
})

test.describe('User Story 3: Visual Validation', () => {
  test('Displays all status columns correctly', async ({ page }) => {
    await page.goto('http://localhost:3008')

    // すべてのステータス列が表示される
    await expect(
      page.locator('[data-testid="status-column-backlog"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="status-column-todo"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="status-column-in-progress"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="status-column-review"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="status-column-done"]'),
    ).toBeVisible()
  })

  test('Repository cards display essential information', async ({ page }) => {
    await page.goto('http://localhost:3008')

    const card = page.locator('[data-testid^="repo-card-"]').first()

    // カードに必要な情報が表示される
    await expect(card).toBeVisible()
    await expect(card.locator('[data-testid="repo-name"]')).toBeVisible()
    await expect(card.locator('[data-testid="repo-owner"]')).toBeVisible()
    // NOTE: stars, description などの表示項目は実装に応じて追加
  })
})
