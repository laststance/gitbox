/**
 * Browser proof for TODO fixes that unit tests and stories already cover.
 *
 * The fixture user and MSW stand in for GitHub. A signed-in check as the
 * owner is a separate step, after this file is green.
 */

import type { Page } from '@playwright/test'

import { test, expect } from '../fixtures/coverage'
import { cdpColumnDragAndDrop } from '../helpers/cdp-drag'
import {
  BOARD_IDS,
  CARD_IDS,
  STATUS_IDS,
  TEST_USER_ID,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
  resetProjectInfoComments,
  resetProjectInfoNotes,
} from '../helpers/db-query'

/** `noteDraftKey` of the seed user and card 1 (`testuser/test-repo`). */
const CARD_1_DRAFT_KEY = `${TEST_USER_ID}/testuser/test-repo`

/** Sentence MSW and `supabase/seed.sql` both store on card 1. */
const FIXTURE_DESCRIPTION = 'A test repository for GitBox'

/** Written over card 1 before Refresh from GitHub, then put back. */
const STALE_DESCRIPTION = 'Stale description before refresh'

/** Scratch board for the column-undo test. Deleted before and after. */
const UNDO_BOARD_NAME = 'Undo coverage scratch'

/** Platform-aware modifier: Cmd on macOS, Ctrl on Linux (CI). */
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

/** How long to keep watching after Cancel. The persist write waits 300ms. */
const DRAFT_SETTLE_MS = 500

test.describe('Shipped TODO coverage', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  // Value: protects=the boards drag handle and the kanban card point at board-list and kanban-board; fails_when=dnd-kit's generated DndDescribedBy id is used, or favorites mounts board-list; why_new=PR #291 proved the ids in a unit hydrate test only; seam=the fixture browser; no_claim=a drag that ends before paint
  test('points the boards handle and the kanban card at stable description ids', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
    // The handle is opacity 0 until the card is hovered, so it is in the
    // document without being visible.
    const handle = page.getByTestId(`drag-handle-${BOARD_IDS.testBoard}`)
    await expect(
      page.getByTestId(`sortable-board-card-${BOARD_IDS.testBoard}`),
    ).toBeVisible()

    // Assert
    await expect(handle).toHaveAttribute('aria-describedby', 'board-list')
    await expect(page.locator('#board-list')).toHaveCount(1)

    await page.goto(`/board/${BOARD_IDS.testBoard}`)
    await page.waitForLoadState('networkidle')
    const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('aria-describedby', 'kanban-board', {
      timeout: 15000,
    })
    await expect(page.locator('#kanban-board')).toHaveCount(1)

    await page.goto('/boards/favorites')
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('heading', { name: 'Favorite Boards', exact: true }),
    ).toBeVisible()
    await expect(page.locator('#board-list')).toHaveCount(0)
  })

  // Value: protects=Escape and Cancel return focus to the button that opened the picker; fails_when=focus falls on the page; why_new=stories cover it and the Escape test of the organization list does not; seam=the board page; no_claim=focus while an add is in flight
  test('returns focus to Add Repositories and to the column Add Repo button', async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
    await page.waitForLoadState('networkidle')
    const headerButton = page.getByRole('button', { name: 'Add Repositories' })
    const addRepo = page
      .getByTestId(`status-column-${STATUS_IDS.pending}`)
      .locator('[data-column-add-repo]')

    // Act: the header button
    await headerButton.click()
    await expect(page.getByPlaceholder('Search repositories...')).toBeVisible()
    await page.keyboard.press('Escape')

    // Assert
    await expect(headerButton).toBeFocused()

    // Act: a column's Add Repo button
    await addRepo.click()
    await expect(page.getByPlaceholder('Search repositories...')).toBeVisible()
    await page
      .locator('[data-overlay]')
      .getByRole('button', { name: 'Cancel' })
      .click()

    // Assert
    await expect(addRepo).toBeFocused()
  })

  // Value: protects=busy picker copy and New Board use …, and the search placeholder stays ASCII; fails_when=Loading repositories... or New Board... returns; why_new=FINDING-017; seam=the seed board and MSW catalog; no_claim=the flash of Loading repositories… before MSW answers
  test('uses the ellipsis character on picker load and on New Board', async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
    await page.waitForLoadState('networkidle')

    // Act: open the picker
    await page.getByRole('button', { name: 'Add Repositories' }).click()

    // Assert: placeholder stays three ASCII dots; the ASCII busy label is gone
    await expect(page.getByPlaceholder('Search repositories...')).toBeVisible()
    await expect(page.getByText('Loading repositories...')).toHaveCount(0)
    await expect(page.getByText('Loading repositories…')).toHaveCount(0)

    await page.keyboard.press('Escape')

    // Act: open Move to Another Board on a seed card
    await page.getByTestId(`overflow-menu-trigger-${CARD_IDS.card1}`).click()
    await page.getByTestId(`move-to-another-board-${CARD_IDS.card1}`).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Assert
    await expect(
      dialog.getByRole('button', { name: 'New Board…' }),
    ).toBeVisible()
  })

  // Value: protects=Escape from an empty comment editor focuses the empty comment; fails_when=focus falls on the page; why_new=unit tests and stories cover it and no Playwright test asserts the focused element; seam=card 3, whose seed comment is empty; no_claim=focus after Save of a typed comment
  test('focuses the empty comment after Escape', async ({ page }) => {
    // Arrange: card 1's seed comment is not empty. Card 3's is.
    await resetProjectInfoComments()
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
    await page.waitForLoadState('networkidle')
    const emptyComment = page
      .getByTestId(`repo-card-${CARD_IDS.card3}`)
      .getByTestId('comment-empty-state')

    // Act
    await emptyComment.click()
    await expect(
      page
        .getByTestId(`repo-card-${CARD_IDS.card3}`)
        .getByTestId('comment-inline-edit'),
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Assert
    await expect(emptyComment).toBeFocused()
  })

  // Value: protects=cancel without typing leaves no draft, and typed text is stored; fails_when=an opened note is stored, or typed text never reaches localStorage; why_new=storeTypedDraft is unit-tested only; seam=card 1 and gitbox-state; no_claim=the draft surviving a reload of a second account
  test('stores a note draft only after the text is typed', async ({ page }) => {
    // Arrange
    await resetProjectInfoNotes()
    await page.addInitScript(() => {
      if (sessionStorage.getItem('gitbox-e2e-note-draft-cleared')) return
      localStorage.removeItem('gitbox-state')
      sessionStorage.setItem('gitbox-e2e-note-draft-cleared', 'true')
    })
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
    await page.waitForLoadState('networkidle')
    const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)

    // Act: open and cancel without typing
    await card.getByRole('button', { name: 'Open note' }).click()
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByRole('heading', { name: 'Project Note', exact: true }),
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    const cancelledAt = Date.now()

    // Assert: still absent after the persist delay, not only in the first instant
    await expect
      .poll(async () => {
        const notes = await readDraftNotes(page)
        const absent = notes[CARD_1_DRAFT_KEY] === undefined
        return absent && Date.now() - cancelledAt >= DRAFT_SETTLE_MS
      })
      .toBe(true)

    // Act: type
    await card.getByRole('button', { name: 'Open note' }).click()
    await expect(
      dialog.getByRole('heading', { name: 'Project Note', exact: true }),
    ).toBeVisible()
    const editor = dialog.locator('[data-slate-editor="true"]')
    await editor.click()
    // The seed note is already in the editor. Replace it, or the first
    // character is typed into that sentence instead of standing alone.
    await page.keyboard.press(`${MOD}+a`)
    await page.keyboard.press('Backspace')
    await page.keyboard.type('draft-only-when-typed')

    // Assert
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem('gitbox-state') ?? ''),
      )
      .toContain('draft-only-when-typed')
  })

  // Value: protects=Sign Out clears draft notes and move destinations and keeps the theme; fails_when=the draft or the destination remains, or the theme is reset; why_new=forgetAccountOnThisBrowser has no browser test; seam=localStorage of the fixture browser; no_claim=the redirect to /, because the fixture session is not a GoTrue session and sign-out throws, and account deletion, which this test does not run
  test('clears drafts and move destinations on Sign Out and keeps the theme', async ({
    page,
  }) => {
    // Arrange
    const stored = {
      state: {
        settings: {
          theme: 'rust',
          compactMode: false,
          showCardMetadata: true,
          organizationFilter: 'all',
          sidebarCollapsed: false,
          moveDestinationByBoard: {
            [BOARD_IDS.testBoard]: BOARD_IDS.workProjects,
          },
        },
        draft: {
          notes: {
            [CARD_1_DRAFT_KEY]: {
              repoKey: CARD_1_DRAFT_KEY,
              content: 'sign-out draft',
              links: [],
              lastModified: 1,
            },
          },
        },
      },
    }
    await page.addInitScript((payload) => {
      if (sessionStorage.getItem('gitbox-e2e-sign-out-seeded')) return
      localStorage.setItem('gitbox-state', JSON.stringify(payload))
      sessionStorage.setItem('gitbox-e2e-sign-out-seeded', 'true')
    }, stored)
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
    await expect
      .poll(() => readDraftNotes(page))
      .toHaveProperty(CARD_1_DRAFT_KEY)

    // Act: the client clears storage before the server action. The fixture
    // token is not a GoTrue session, so the action throws and the page stays.
    await page.getByRole('button', { name: 'Sign Out' }).click()

    // Assert
    // toMatchObject treats {} as "any object", so a leftover draft would pass.
    await expect
      .poll(async () => {
        const state = await readPersisted(page)
        const settings = state?.settings as
          | {
              theme?: string
              moveDestinationByBoard?: Record<string, string>
            }
          | undefined
        const draft = state?.draft as
          { notes?: Record<string, unknown> } | undefined
        return {
          theme: settings?.theme ?? null,
          moveDestinations: settings?.moveDestinationByBoard ?? null,
          notes: draft?.notes ?? null,
        }
      })
      .toEqual({
        theme: 'rust',
        moveDestinations: {},
        notes: {},
      })
    await expect(page).toHaveURL(/\/boards$/)
  })

  test.describe('Refresh from GitHub', () => {
    test.afterEach(async () => {
      await writeCard1Description(FIXTURE_DESCRIPTION)
    })

    // Value: protects=Refresh from GitHub replaces a stale description with the fixture sentence and shows Refreshed from GitHub; fails_when=the stale sentence stays; why_new=the seed sentence already matches MSW, so no earlier test could see a change; seam=MSW stands in for GitHub; no_claim=a private repository GitHub would refuse
    test('replaces a stale card description from the fixture catalog', async ({
      page,
    }) => {
      // Arrange
      await writeCard1Description(STALE_DESCRIPTION)
      await page.goto(`/board/${BOARD_IDS.testBoard}`)
      await page.waitForLoadState('networkidle')
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      await expect(card.getByText(STALE_DESCRIPTION)).toBeVisible()

      // Act
      await page.getByTestId(`overflow-menu-trigger-${CARD_IDS.card1}`).click()
      await page.getByTestId(`refresh-from-github-${CARD_IDS.card1}`).click()

      // Assert
      await expect(page.getByText('Refreshed from GitHub')).toBeVisible()
      await expect(card.getByText(STALE_DESCRIPTION)).toHaveCount(0)
      await expect(card.getByText(FIXTURE_DESCRIPTION)).toBeVisible()
    })
  })

  test.describe('Column undo', () => {
    test.beforeEach(removeUndoBoards)
    test.afterEach(removeUndoBoards)

    // Value: protects=Z after a column drag, with no column deleted, puts Alpha back to the left of Beta and shows Column order restored; fails_when=Alpha stays where the drag left it, or the toast is missing; why_new=the column walk must still apply a snapshot whose columns are all still here; seam=a scratch board and a CDP drag; no_claim=a deleted column
    test('puts a dragged column back when every column is still on the board', async ({
      page,
    }) => {
      // Arrange: two columns, Alpha to the left of Beta
      const created = await createTestUserSupabaseClient().rpc(
        'create_board_with_status_lists',
        {
          p_name: UNDO_BOARD_NAME,
          p_columns: [
            { name: 'Alpha', color: '#111111' },
            { name: 'Beta', color: '#222222' },
          ],
        },
      )
      expect(created.error).toBeNull()
      const boardId: string = created.data.id
      const lists = created.data.status_lists as { id: string; name: string }[]
      const alpha = lists.find((column) => column.name === 'Alpha')
      const beta = lists.find((column) => column.name === 'Beta')
      if (alpha === undefined || beta === undefined) {
        throw new Error('the scratch board did not return Alpha and Beta')
      }
      await page.goto(`/board/${boardId}`)
      await page.waitForLoadState('networkidle')
      const alphaColumn = page.getByTestId(`sortable-column-${alpha.id}`)
      const betaColumn = page.getByTestId(`sortable-column-${beta.id}`)
      const alphaHeading = alphaColumn.getByRole('heading', {
        name: 'Alpha',
        exact: true,
      })
      const betaHeading = betaColumn.getByRole('heading', {
        name: 'Beta',
        exact: true,
      })
      await expect(alphaHeading).toBeVisible()
      await expect(betaHeading).toBeVisible()
      const alphaBefore = await alphaHeading.boundingBox()
      const betaBefore = await betaHeading.boundingBox()
      if (alphaBefore === null || betaBefore === null) {
        throw new Error('Alpha or Beta has no box')
      }
      expect(alphaBefore.x).toBeLessThan(betaBefore.x)

      // Act
      await cdpColumnDragAndDrop(page, alpha.id, beta.id)
      await expect
        .poll(async () => {
          const box = await alphaHeading.boundingBox()
          return box !== null && box.x > alphaBefore.x + 40
        })
        .toBe(true)
      await page.keyboard.press('z')

      // Assert: Alpha is back to the left of Beta
      await expect(page.getByText('Column order restored')).toBeVisible()
      await expect
        .poll(async () => {
          const alphaBox = await alphaHeading.boundingBox()
          const betaBox = await betaHeading.boundingBox()
          return alphaBox !== null && betaBox !== null && alphaBox.x < betaBox.x
        })
        .toBe(true)
    })

    // Value: protects=Z after deleting a column leaves the dragged column where the drag put it, keeps the deleted column gone, and does not show Column order restored; fails_when=Alpha moves back, Beta returns, or that toast is shown; why_new=a column undo used to move the survivors to the snapshot that still named the deleted column; seam=a scratch board and a CDP drag; no_claim=card undo, and the positions of seed columns
    test('keeps a deleted column gone when the column drag is undone', async ({
      page,
    }) => {
      // Arrange: two columns, Alpha to the left of Beta
      const created = await createTestUserSupabaseClient().rpc(
        'create_board_with_status_lists',
        {
          p_name: UNDO_BOARD_NAME,
          p_columns: [
            { name: 'Alpha', color: '#111111' },
            { name: 'Beta', color: '#222222' },
          ],
        },
      )
      expect(created.error).toBeNull()
      const boardId: string = created.data.id
      const lists = created.data.status_lists as { id: string; name: string }[]
      const alpha = lists.find((column) => column.name === 'Alpha')
      const beta = lists.find((column) => column.name === 'Beta')
      if (alpha === undefined || beta === undefined) {
        throw new Error('the scratch board did not return Alpha and Beta')
      }
      await page.goto(`/board/${boardId}`)
      await page.waitForLoadState('networkidle')
      // The drag overlay copies the title outside the column. The column's
      // own heading is the one that moves with the grid.
      const alphaColumn = page.getByTestId(`sortable-column-${alpha.id}`)
      const betaColumn = page.getByTestId(`sortable-column-${beta.id}`)
      const alphaHeading = alphaColumn.getByRole('heading', {
        name: 'Alpha',
        exact: true,
      })
      const betaHeading = betaColumn.getByRole('heading', {
        name: 'Beta',
        exact: true,
      })
      await expect(alphaHeading).toBeVisible()
      await expect(betaHeading).toBeVisible()
      await expect(
        page.getByTestId(`sortable-column-${alpha.id}`),
      ).toBeVisible()
      const alphaBefore = await alphaHeading.boundingBox()
      const betaBefore = await betaHeading.boundingBox()
      if (alphaBefore === null || betaBefore === null) {
        throw new Error('Alpha or Beta has no box')
      }
      expect(alphaBefore.x).toBeLessThan(betaBefore.x)

      // Act: a real column move, so the drop handler pushes undo history.
      // A swap puts Alpha where Beta was, so its x is about Beta's old x,
      // not past it.
      await cdpColumnDragAndDrop(page, alpha.id, beta.id)
      await expect
        .poll(async () => {
          const box = await alphaHeading.boundingBox()
          return box !== null && box.x > alphaBefore.x + 40
        })
        .toBe(true)

      await page
        .getByTestId(`status-column-${beta.id}`)
        .getByRole('button', { name: 'Column options' })
        .click()
      await page.getByRole('menuitem', { name: 'Delete Column' }).click()
      await page.getByRole('button', { name: 'Delete column Beta' }).click()
      await expect(page.getByRole('alertdialog')).toBeHidden()
      await expect(betaHeading).toHaveCount(0)
      await page.keyboard.press('z')

      // Assert: Alpha stays where the drag put it, and the restore toast
      // does not appear. The info toast is how we know Z was heard.
      await expect(
        page.getByText('Nothing to undo on this board'),
      ).toBeVisible()
      await expect(page.getByText('Column order restored')).toHaveCount(0)
      await expect(betaHeading).toHaveCount(0)
      await expect
        .poll(async () => {
          const box = await alphaHeading.boundingBox()
          return box !== null && box.x > alphaBefore.x + 40
        })
        .toBe(true)
    })
  })

  // Value: protects=a board name near its limit uses the warning token; fails_when=the counter stays muted or names orange-800; why_new=NEAR_LIMIT_COUNTER_TEXT_CLASS is now text-warning; seam=the fixture board settings dialog; no_claim=every theme in this browser
  test('paints the near-limit board name counter with the warning token', async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /board settings/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const nameField = dialog.getByRole('textbox').first()

    // Act: 40 characters is max-10 for a 50-character name
    await nameField.fill('a'.repeat(40))
    const counter = dialog.getByText('40/50')

    // Assert
    await expect(counter).toBeVisible()
    await expect(counter).toHaveClass(/text-warning/)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  // Value: protects=a favorited star uses --favorite, not amber-700; fails_when=the class or the painted color misses the token, or hover paints accent-foreground; why_new=the star is text-favorite; seam=the fixture boards page; no_claim=every named theme
  test('paints a favorited star with the favorite token', async ({ page }) => {
    // Arrange
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
    const card = page.getByTestId(`sortable-board-card-${BOARD_IDS.testBoard}`)
    await expect(card).toBeVisible()
    const star = card.locator('button[aria-label*="favorite"]')
    const label = await star.getAttribute('aria-label')
    if (label?.includes('Add')) {
      await star.click()
      await expect(star).toHaveAttribute('aria-label', /Remove/)
    }

    // Assert
    await expect(star).toHaveClass(/(?:^|\s)text-favorite(?:\s|$)/)
    const atRest = await colorsOfStarAndToken(page, star)
    expect(atRest.painted).toBe(atRest.token)

    await star.hover()
    const hovered = await colorsOfStarAndToken(page, star)
    expect(hovered.painted).toBe(hovered.token)
  })
})

/**
 * Painted star color and `color: var(--favorite)` on a probe.
 *
 * The token is `oklch(...)` in CSS. The browser paints rgb. Comparing the
 * two computed colors avoids parsing the token.
 */
async function colorsOfStarAndToken(
  page: Page,
  star: ReturnType<Page['locator']>,
): Promise<{ painted: string; token: string }> {
  return star.evaluate((button) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--favorite)'
    document.body.appendChild(probe)
    const painted = getComputedStyle(button).color
    const token = getComputedStyle(probe).color
    probe.remove()
    return { painted, token }
  })
}

/**
 * Notes currently stored for this browser.
 *
 * Called by the note-draft and sign-out tests. The persist middleware writes
 * `{ state: { draft, settings } }` under `gitbox-state`.
 *
 * @param page - The fixture browser page.
 * @returns The draft notes record, or an empty object when nothing is stored.
 */
async function readDraftNotes(page: Page): Promise<Record<string, unknown>> {
  const state = await readPersisted(page)
  const draft = state?.draft as { notes?: Record<string, unknown> } | undefined
  return draft?.notes ?? {}
}

/**
 * Persisted Redux document, without the storage wrapper.
 *
 * @param page - The fixture browser page.
 * @returns `state` from `gitbox-state`, or null when the key is absent.
 */
async function readPersisted(
  page: Page,
): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('gitbox-state')
    if (raw === null) return null
    const parsed: { state?: Record<string, unknown> } = JSON.parse(raw)
    return parsed.state ?? null
  })
}

/**
 * Replace card 1's description and leave the rest of `meta` as it is.
 *
 * Called before Refresh from GitHub, and again afterwards so later files in
 * the shard still see the seed sentence.
 *
 * @param description - The sentence to store.
 */
async function writeCard1Description(description: string): Promise<void> {
  const client = createServiceRoleSupabaseClient()
  const current = await client
    .from('repocard')
    .select('meta')
    .eq('id', CARD_IDS.card1)
    .single()
  if (current.error) {
    throw new Error(`read card 1 meta: ${current.error.message}`)
  }
  const meta = {
    ...(current.data.meta as Record<string, unknown>),
    description,
  }
  const updated = await client
    .from('repocard')
    .update({ meta })
    .eq('id', CARD_IDS.card1)
  if (updated.error) {
    throw new Error(`write card 1 meta: ${updated.error.message}`)
  }
}

/**
 * Delete the scratch board this file creates.
 *
 * Called before and after the column-undo test. A board left by a failed run
 * would be found by name the next time.
 */
async function removeUndoBoards(): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('board')
    .delete()
    .eq('name', UNDO_BOARD_NAME)
  if (error) {
    throw new Error(`removeUndoBoards failed: ${error.message}`)
  }
}
