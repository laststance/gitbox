/**
 * E2E Test: Repository Search and Add (User Story 2)
 *
 * テスト対象:
 * - GitHub Repositoryを検索してKanbanボードに追加
 * - Comboboxで複数Repository選択
 * - 重複Repository検出
 * - フィルター検索 (owner, topics, visibility)
 * - Quick noteへのフォーカス移動
 *
 * 前提条件:
 * - Supabase ローカル環境が起動している
 * - GitHub OAuth認証済み状態
 * - 開発サーバーが起動している (pnpm dev)
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// Supabase Admin クライアント
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// テスト用ユーザーとボード
let testUser: {
  id: string
  email: string
  accessToken: string
  refreshToken: string
}
let testBoard: { id: string; name: string }

test.describe('User Story 2: Repository Search and Add', () => {
  test.beforeAll(async () => {
    // テスト用ユーザーを作成
    const { data: createUserResponse, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: 'us2-test-user@example.com',
        password: 'us2-test-password-123',
        email_confirm: true,
        user_metadata: {
          avatar_url: 'https://avatars.githubusercontent.com/u/999999',
          user_name: 'us2-test-user',
        },
      })

    if (createUserError) throw createUserError

    const { data: sessionData, error: sessionError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: 'us2-test-user@example.com',
        password: 'us2-test-password-123',
      })

    if (sessionError) throw sessionError

    testUser = {
      id: createUserResponse.user.id,
      email: createUserResponse.user.email!,
      accessToken: sessionData.session!.access_token,
      refreshToken: sessionData.session!.refresh_token,
    }

    // テスト用ボードを作成
    const { data: boardData, error: boardError } = await supabaseAdmin
      .from('Board')
      .insert({
        user_id: testUser.id,
        name: 'US2 Test Board',
        theme: 'sunrise',
      })
      .select()
      .single()

    if (boardError) throw boardError
    testBoard = { id: boardData.id, name: boardData.name }
  })

  test.afterAll(async () => {
    // クリーンアップ
    if (testBoard) {
      await supabaseAdmin.from('Board').delete().eq('id', testBoard.id)
    }
    if (testUser) {
      await supabaseAdmin.auth.admin.deleteUser(testUser.id)
    }
  })

  test('S1: Repository検索と複数選択・追加フロー', async ({ page, context }) => {
    // セッションを設定して認証状態にする
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
      },
    ])

    await page.goto(`http://localhost:3008/ja/board/${testBoard.id}`)

    // "Add Repositories" ボタンをクリック
    const addButton = page.getByRole('button', {
      name: /Add Repositories|Repository.*追加/i,
    })
    await expect(addButton).toBeVisible()
    await addButton.click()

    // Combobox が表示される
    const combobox = page.getByRole('combobox')
    await expect(combobox).toBeVisible()

    // 検索キーワード入力
    const searchInput = page.getByPlaceholder(/Search repositories/i)
    await searchInput.fill('react')

    // 候補が1秒以内に表示される (Performance requirement)
    const startTime = Date.now()
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 1000 })
    const endTime = Date.now()
    const responseTime = endTime - startTime

    // パフォーマンス要件: <1秒
    expect(responseTime).toBeLessThan(1000)

    // 複数リポジトリを選択
    await page.getByRole('option', { name: /facebook\/react/i }).click()
    await page.getByRole('option', { name: /reactjs\/react.dev/i }).click()

    // 選択したリポジトリがバッジ表示される
    await expect(page.getByText('facebook/react')).toBeVisible()
    await expect(page.getByText('reactjs/react.dev')).toBeVisible()

    // "Add" ボタンをクリック (選択数表示)
    const confirmAddButton = page.getByRole('button', {
      name: /Add \(2\)|追加 \(2\)/i,
    })
    await confirmAddButton.click()

    // Boardにリポジトリカードが追加される
    await expect(page.locator('.repo-card').filter({ hasText: 'facebook/react' })).toBeVisible()
    await expect(page.locator('.repo-card').filter({ hasText: 'reactjs/react.dev' })).toBeVisible()

    // "Quick note" フィールドにフォーカスが移動
    const quickNoteField = page.getByPlaceholder(/Quick note/i)
    await expect(quickNoteField).toBeFocused()
  })

  test('S2: 重複Repository検出エラー', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
      },
    ])

    // 既存リポジトリを追加
    const { error: insertError } = await supabaseAdmin.from('RepoCard').insert({
      board_id: testBoard.id,
      status_id: '00000000-0000-0000-0000-000000000000', // Dummy status ID
      repo_owner: 'laststance',
      repo_name: 'gitbox',
      note: 'Already added',
      order: 0,
    })

    if (insertError) console.error('Insert error:', insertError)

    await page.goto(`http://localhost:3008/ja/board/${testBoard.id}`)

    // Repository追加試行
    await page.getByRole('button', { name: /Add Repositories/i }).click()
    await page.getByPlaceholder(/Search repositories/i).fill('gitbox')
    await page.getByRole('option', { name: /laststance\/gitbox/i }).click()
    await page.getByRole('button', { name: /Add \(1\)/i }).click()

    // 重複エラーメッセージ表示
    const errorMessage = page.getByRole('alert')
    await expect(errorMessage).toContainText(/already added|既に追加/i)
  })

  test('S3: フィルター検索 (owner, topics, visibility)', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
      },
    ])

    await page.goto(`http://localhost:3008/ja/board/${testBoard.id}`)
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // Owner filter
    const ownerFilter = page.getByPlaceholder(/Filter by owner/i)
    await ownerFilter.fill('facebook')

    // 検索実行
    await page.getByPlaceholder(/Search repositories/i).fill('react')

    // フィルター結果が反映される
    await expect(page.getByRole('option').first()).toContainText('facebook')

    // Topics filter
    const topicsFilter = page.getByLabel(/Filter by topics/i)
    if (await topicsFilter.isVisible()) {
      await topicsFilter.click()
      await page.getByRole('checkbox', { name: /react/i }).check()
    }

    // Visibility filter
    const visibilityFilter = page.getByRole('combobox', { name: /visibility/i })
    if (await visibilityFilter.isVisible()) {
      await visibilityFilter.selectOption('public')
    }

    // フィルター結果が表示される
    await expect(page.getByRole('option')).toHaveCount({ min: 1 })
  })

  test('S4: 100+リポジトリでのVirtual Scrolling', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
      },
    ])

    await page.goto(`http://localhost:3008/ja/board/${testBoard.id}`)
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // 広範囲検索 (100+結果を期待)
    await page.getByPlaceholder(/Search repositories/i).fill('javascript')

    // Virtual scrolling コンテナが存在する
    const virtualContainer = page.locator('[data-virtual-scroll]')
    await expect(virtualContainer).toBeVisible()

    // 表示されているoptionの数を確認 (全てはレンダリングされていない)
    const visibleOptions = await page.getByRole('option').count()
    expect(visibleOptions).toBeLessThan(100) // 仮想スクロールで一部のみ表示

    // スクロールして追加アイテムをロード
    await virtualContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2
    })

    // スクロール後も option が表示される
    await expect(page.getByRole('option').first()).toBeVisible()
  })

  test('S5: Loading状態とエラーハンドリング', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
      },
    ])

    await page.goto(`http://localhost:3008/ja/board/${testBoard.id}`)
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // 検索中はLoading indicatorが表示される
    await page.getByPlaceholder(/Search repositories/i).fill('react')

    const loadingIndicator = page.getByRole('status')
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toBeVisible()
    }

    // API エラーシミュレーション (ネットワークエラー)
    await page.route('**/api/github/**', (route) => route.abort('failed'))

    await page.getByPlaceholder(/Search repositories/i).fill('error-test')

    // エラーメッセージが表示される
    const errorAlert = page.getByRole('alert')
    await expect(errorAlert).toBeVisible()
    await expect(errorAlert).toContainText(/Error|エラー/i)
  })

  test('S6: キーボードナビゲーション (WCAG AA)', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
      },
    ])

    await page.goto(`http://localhost:3008/ja/board/${testBoard.id}`)
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    const searchInput = page.getByPlaceholder(/Search repositories/i)
    await searchInput.fill('react')

    // Tab キーでオプションにフォーカス移動
    await searchInput.press('Tab')

    // Enter キーで選択
    await page.keyboard.press('Enter')

    // 選択されたことを確認 (aria-selected="true")
    const selectedOption = page.getByRole('option', { selected: true })
    await expect(selectedOption).toBeVisible()

    // Escape キーでComboboxを閉じる
    await page.keyboard.press('Escape')
    await expect(page.getByRole('option').first()).not.toBeVisible()
  })
})
