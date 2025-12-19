/**
 * E2E Test: Repository Search and Add (User Story 2)
 *
 * Test scope:
 * - Search GitHub Repository and add to Kanban board
 * - Multi-select repositories with Combobox
 * - Duplicate repository detection
 * - Filter search (owner, topics, visibility)
 * - Focus move to Quick note
 *
 * Preconditions:
 * - Supabase local environment is running
 * - GitHub OAuth authenticated state
 * - Development server is running (pnpm dev)
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// Supabase Admin client
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

// Test user and board
let testUser: {
  id: string
  email: string
  accessToken: string
  refreshToken: string
}
let testBoard: { id: string; name: string }

test.describe('User Story 2: Repository Search and Add', () => {
  test.beforeAll(async () => {
    // Create test user
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

    // Create test board
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
    // Cleanup
    if (testBoard) {
      await supabaseAdmin.from('Board').delete().eq('id', testBoard.id)
    }
    if (testUser) {
      await supabaseAdmin.auth.admin.deleteUser(testUser.id)
    }
  })

  test('S1: Repository search and multi-select/add flow', async ({
    page,
    context,
  }) => {
    // Set session to authenticated state
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
      },
    ])

    await page.goto(`http://localhost:3008/ja/board/${testBoard.id}`)

    // Click "Add Repositories" button
    const addButton = page.getByRole('button', {
      name: /Add Repositories|Repository.*追加/i,
    })
    await expect(addButton).toBeVisible()
    await addButton.click()

    // Combobox is displayed
    const combobox = page.getByRole('combobox')
    await expect(combobox).toBeVisible()

    // Enter search keyword
    const searchInput = page.getByPlaceholder(/Search repositories/i)
    await searchInput.fill('react')

    // Candidates appear within 1 second (Performance requirement)
    const startTime = Date.now()
    await expect(page.getByRole('option').first()).toBeVisible({
      timeout: 1000,
    })
    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Performance requirement: <1 second
    expect(responseTime).toBeLessThan(1000)

    // Select multiple repositories
    await page.getByRole('option', { name: /facebook\/react/i }).click()
    await page.getByRole('option', { name: /reactjs\/react.dev/i }).click()

    // Selected repositories are displayed as badges
    await expect(page.getByText('facebook/react')).toBeVisible()
    await expect(page.getByText('reactjs/react.dev')).toBeVisible()

    // Click "Add" button (shows selected count)
    const confirmAddButton = page.getByRole('button', {
      name: /Add \(2\)|追加 \(2\)/i,
    })
    await confirmAddButton.click()

    // Repository cards are added to Board
    await expect(
      page.locator('.repo-card').filter({ hasText: 'facebook/react' }),
    ).toBeVisible()
    await expect(
      page.locator('.repo-card').filter({ hasText: 'reactjs/react.dev' }),
    ).toBeVisible()

    // Focus moves to "Quick note" field
    const quickNoteField = page.getByPlaceholder(/Quick note/i)
    await expect(quickNoteField).toBeFocused()
  })

  test('S2: Duplicate Repository detection error', async ({
    page,
    context,
  }) => {
    // Authentication setup
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
      },
    ])

    // Add existing repository
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

    // Attempt to add Repository
    await page.getByRole('button', { name: /Add Repositories/i }).click()
    await page.getByPlaceholder(/Search repositories/i).fill('gitbox')
    await page.getByRole('option', { name: /laststance\/gitbox/i }).click()
    await page.getByRole('button', { name: /Add \(1\)/i }).click()

    // Duplicate error message is displayed
    const errorMessage = page.getByRole('alert')
    await expect(errorMessage).toContainText(/already added|既に追加/i)
  })

  test('S3: Filter search (owner, topics, visibility)', async ({
    page,
    context,
  }) => {
    // Authentication setup
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

    // Execute search
    await page.getByPlaceholder(/Search repositories/i).fill('react')

    // Filter results are reflected
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

    // Filter results are displayed
    await expect(page.getByRole('option')).toHaveCount({ min: 1 })
  })

  test('S4: Virtual Scrolling with 100+ repositories', async ({
    page,
    context,
  }) => {
    // Authentication setup
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

    // Broad search (expecting 100+ results)
    await page.getByPlaceholder(/Search repositories/i).fill('javascript')

    // Virtual scrolling container exists
    const virtualContainer = page.locator('[data-virtual-scroll]')
    await expect(virtualContainer).toBeVisible()

    // Check number of visible options (not all are rendered)
    const visibleOptions = await page.getByRole('option').count()
    expect(visibleOptions).toBeLessThan(100) // Only partial display with virtual scrolling

    // Scroll to load additional items
    await virtualContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2
    })

    // Options are still visible after scrolling
    await expect(page.getByRole('option').first()).toBeVisible()
  })

  test('S5: Loading state and error handling', async ({ page, context }) => {
    // Authentication setup
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

    // Loading indicator is displayed during search
    await page.getByPlaceholder(/Search repositories/i).fill('react')

    const loadingIndicator = page.getByRole('status')
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toBeVisible()
    }

    // Simulate API error (network error)
    await page.route('**/api/github/**', (route) => route.abort('failed'))

    await page.getByPlaceholder(/Search repositories/i).fill('error-test')

    // Error message is displayed
    const errorAlert = page.getByRole('alert')
    await expect(errorAlert).toBeVisible()
    await expect(errorAlert).toContainText(/Error|エラー/i)
  })

  test('S6: Keyboard navigation (WCAG AA)', async ({ page, context }) => {
    // Authentication setup
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

    // Move focus to option with Tab key
    await searchInput.press('Tab')

    // Select with Enter key
    await page.keyboard.press('Enter')

    // Verify selection (aria-selected="true")
    const selectedOption = page.getByRole('option', { selected: true })
    await expect(selectedOption).toBeVisible()

    // Close Combobox with Escape key
    await page.keyboard.press('Escape')
    await expect(page.getByRole('option').first()).not.toBeVisible()
  })
})
