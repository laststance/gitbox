/**
 * E2E Screenshot Test: User Story 2 - Repository Search and Add
 *
 * Purpose: Capture screenshots of repository search and add flow
 *
 * Screenshot targets:
 * 1. Empty search state (initial state)
 * 2. Search results (search results display)
 * 3. Multi-select state (multiple selection state)
 * 4. Filter UI (filter UI)
 * 5. Duplicate error (duplicate error display)
 * 6. Loading state (loading state)
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

test.describe('User Story 2: Repository Search Screenshots', () => {
  test.beforeAll(async () => {
    // Create test user
    const { data: createUserResponse, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: 'us2-screenshot-user@example.com',
        password: 'us2-screenshot-password-123',
        email_confirm: true,
        user_metadata: {
          avatar_url: 'https://avatars.githubusercontent.com/u/888888',
          user_name: 'us2-screenshot-user',
        },
      })

    if (createUserError) throw createUserError

    const { data: sessionData, error: sessionError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: 'us2-screenshot-user@example.com',
        password: 'us2-screenshot-password-123',
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
        name: 'US2 Screenshot Test Board',
        theme: 'ocean',
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

  test('Screenshot 1: Empty search state', async ({ page, context }) => {
    // Authentication setup
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Click "Add Repositories" button
    const addButton = page.getByRole('button', {
      name: /Add Repositories|Repository.*追加/i,
    })
    await expect(addButton).toBeVisible()
    await addButton.click()

    // Combobox is displayed
    const combobox = page.getByRole('combobox')
    await expect(combobox).toBeVisible()

    // Capture screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/us2-repo-search/01-empty-search-state.png',
      fullPage: true,
    })
  })

  test('Screenshot 2: Search results', async ({ page, context }) => {
    // Authentication setup
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Open repository add flow
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // Enter search keyword
    const searchInput = page.getByPlaceholder(/Search repositories/i)
    await searchInput.fill('react')

    // Wait for search results to display
    await expect(page.getByRole('option').first()).toBeVisible()

    // Capture screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/us2-repo-search/02-search-results.png',
      fullPage: true,
    })
  })

  test('Screenshot 3: Multi-select state', async ({ page, context }) => {
    // Authentication setup
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Open repository add flow
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // Search and multi-select
    const searchInput = page.getByPlaceholder(/Search repositories/i)
    await searchInput.fill('react')
    await expect(page.getByRole('option').first()).toBeVisible()

    await page.getByRole('option', { name: /facebook\/react/i }).click()
    await page.getByRole('option', { name: /reactjs\/react.dev/i }).click()

    // Selected repositories are displayed as badges
    await expect(page.getByText('facebook/react')).toBeVisible()
    await expect(page.getByText('reactjs/react.dev')).toBeVisible()

    // Capture screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/us2-repo-search/03-multi-select-state.png',
      fullPage: true,
    })
  })

  test('Screenshot 4: Filter UI', async ({ page, context }) => {
    // Authentication setup
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Open repository add flow
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // Use owner filter
    const ownerFilter = page.getByPlaceholder(/Filter by owner/i)
    if (await ownerFilter.isVisible()) {
      await ownerFilter.fill('facebook')
    }

    // Execute search
    await page.getByPlaceholder(/Search repositories/i).fill('react')
    await expect(page.getByRole('option').first()).toBeVisible()

    // Capture screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/us2-repo-search/04-filter-ui.png',
      fullPage: true,
    })
  })

  test('Screenshot 5: Duplicate error', async ({ page, context }) => {
    // Authentication setup
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    // Add existing repository
    const { error: insertError } = await supabaseAdmin.from('RepoCard').insert({
      board_id: testBoard.id,
      status_id: '00000000-0000-0000-0000-000000000000', // Dummy status ID
      repo_owner: 'laststance',
      repo_name: 'gitbox',
      note: 'Already added for screenshot test',
      order: 0,
    })

    if (insertError) console.error('Insert error:', insertError)

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Attempt to add repository
    await page.getByRole('button', { name: /Add Repositories/i }).click()
    await page.getByPlaceholder(/Search repositories/i).fill('gitbox')
    await page.getByRole('option', { name: /laststance\/gitbox/i }).click()
    await page.getByRole('button', { name: /Add \(1\)/i }).click()

    // Wait for duplicate error message to display
    const errorMessage = page.getByRole('alert')
    await expect(errorMessage).toBeVisible()

    // Capture screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/us2-repo-search/05-duplicate-error.png',
      fullPage: true,
    })
  })

  test('Screenshot 6: Loading state', async ({ page, context }) => {
    // Authentication setup
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Open repository add flow
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // Start search (take screenshot immediately to capture loading state)
    const searchInput = page.getByPlaceholder(/Search repositories/i)
    await searchInput.fill('react')

    // Loading indicator may be displayed
    const loadingIndicator = page.getByRole('status')
    if (await loadingIndicator.isVisible({ timeout: 500 }).catch(() => false)) {
      // Capture screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/us2-repo-search/06-loading-state.png',
        fullPage: true,
      })
    } else {
      // If loading is too fast to capture, capture the state before search results are displayed
      await page.screenshot({
        path: 'tests/e2e/screenshots/us2-repo-search/06-loading-state.png',
        fullPage: true,
      })
    }
  })
})
