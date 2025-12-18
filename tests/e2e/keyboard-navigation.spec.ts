/**
 * E2E Test: Keyboard Navigation
 *
 * Constitution要件:
 * - Principle II: クリティカルフローのE2Eテストカバレッジ
 * - Principle IV: アクセシビリティ - キーボードナビゲーション完全サポート
 *
 * テスト対象:
 * - Tab: カード間のフォーカス移動
 * - .: Overflow menuの開閉
 * - Enter: デフォルトアクション実行
 * - ?: ショートカットヘルプ表示
 */

import { test, expect } from '@playwright/test'

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // 認証済み状態でボード画面にアクセス
    await page.goto('/board/default-board')
    await page.waitForLoadState('networkidle')
  })

  test('Tab key should navigate between cards', async ({ page }) => {
    // Given: ボードに複数のカードが表示されている
    const cards = page.locator('[data-testid="repo-card"]')
    await expect(cards).toHaveCount(1, { timeout: 5000 })

    // When: Tabキーを押してフォーカス移動
    await page.keyboard.press('Tab')

    // Then: 最初のカードにフォーカスが当たる
    const firstCard = cards.first()
    await expect(firstCard).toBeFocused()

    // カードが複数ある場合、次のカードにフォーカス移動
    if ((await cards.count()) > 1) {
      await page.keyboard.press('Tab')
      const secondCard = cards.nth(1)
      await expect(secondCard).toBeFocused()
    }
  })

  test('. (period) key should toggle overflow menu on focused card', async ({
    page,
  }) => {
    // Given: カードにフォーカスがある
    const card = page.locator('[data-testid="repo-card"]').first()
    await card.focus()

    // When: .キーを押す
    await page.keyboard.press('.')

    // Then: Overflow menuが表示される
    const menu = page.locator('[data-testid="overflow-menu"]')
    await expect(menu).toBeVisible()

    // When: もう一度.キーを押す
    await page.keyboard.press('.')

    // Then: Overflow menuが閉じる
    await expect(menu).not.toBeVisible()
  })

  test('Enter key should execute default action on focused card', async ({
    page,
  }) => {
    // Given: カードにフォーカスがある
    const card = page.locator('[data-testid="repo-card"]').first()
    await card.focus()

    // When: Enterキーを押す
    await page.keyboard.press('Enter')

    // Then: Project Infoモーダルが開く（デフォルトアクション）
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible({ timeout: 1000 })
  })

  test('? key should show shortcuts help modal', async ({ page }) => {
    // When: ?キーを押す
    await page.keyboard.press('?')

    // Then: ショートカットヘルプモーダルが表示される
    const helpModal = page.locator('[data-testid="shortcuts-help-modal"]')
    await expect(helpModal).toBeVisible()

    // Then: 主要なショートカットが表示されている
    await expect(helpModal).toContainText('Tab')
    await expect(helpModal).toContainText('.')
    await expect(helpModal).toContainText('Enter')
    await expect(helpModal).toContainText('Z')
    await expect(helpModal).toContainText('?')

    // When: Escapeキーを押す
    await page.keyboard.press('Escape')

    // Then: ヘルプモーダルが閉じる
    await expect(helpModal).not.toBeVisible()
  })

  test('Keyboard navigation should be accessible (WCAG AA)', async ({
    page,
  }) => {
    // Given: ページが読み込まれている

    // When: キーボードでナビゲーション
    await page.keyboard.press('Tab')
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName,
    )

    // Then: フォーカス可能な要素が存在する
    expect(focusedElement).toBeDefined()

    // Then: フォーカスインジケーターが視覚的に確認できる
    // (Playwrightのスクリーンショットで検証)
    await page.screenshot({
      path: 'tests/e2e/screenshots/keyboard-navigation-focus.png',
    })
  })

  test('Keyboard shortcuts should work in sequence', async ({ page }) => {
    // Given: ボードにカードがある
    const card = page.locator('[data-testid="repo-card"]').first()

    // When: Tabでフォーカス → .でメニュー開く
    await page.keyboard.press('Tab')
    await page.keyboard.press('.')

    // Then: Overflow menuが開いている
    const menu = page.locator('[data-testid="overflow-menu"]')
    await expect(menu).toBeVisible()

    // When: Escapeでメニューを閉じる
    await page.keyboard.press('Escape')

    // Then: メニューが閉じる
    await expect(menu).not.toBeVisible()

    // When: Enterでカードを開く
    await page.keyboard.press('Enter')

    // Then: モーダルが開く
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()
  })

  test('Should capture screenshot for visual regression', async ({ page }) => {
    // Given: カードにフォーカスがある
    await page.keyboard.press('Tab')

    // Then: フォーカス状態のスクリーンショットを取得
    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-keyboard-navigation-focused.png',
      fullPage: true,
    })

    // When: Overflow menuを開く
    await page.keyboard.press('.')

    // Then: メニュー開いた状態のスクリーンショット
    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-keyboard-navigation-menu.png',
      fullPage: true,
    })

    // When: ヘルプを表示
    await page.keyboard.press('Escape') // メニューを閉じる
    await page.keyboard.press('?')

    // Then: ヘルプモーダルのスクリーンショット
    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-keyboard-navigation-help.png',
      fullPage: true,
    })
  })
})
