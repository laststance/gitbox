/**
 * Names Without a Place to Break E2E Tests
 *
 * A board, a column and a boards page title may have 50 characters, and a
 * repository name 100. Written without a space or a hyphen (snake_case, one
 * long word), such a name is one piece that a line cannot break. A box that
 * cannot shrink below its longest word then grows past its place and takes
 * what stands beside it along: the menu of a card left the card, "Column
 * options" left the column, the buttons of a board's header and "Create
 * Board" left the screen, a dialog scrolled sideways, and a list of boards
 * was wider than a phone.
 *
 * The cure must leave an ordinary word alone. A box that may shrink below
 * its longest word breaks that word as soon as the row gets tight: a board
 * name of eleven letters lost its last two to a second line in a card of
 * 216px, and a title of ten letters broke beside "Create Board" on a phone.
 * Two tests hold one ordinary word on one line, and one says where the
 * button stands from 640px on, where it shares a row with the title.
 *
 * Only a browser lays a page out, so these tests measure where things are.
 */

import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/coverage'
import {
  BOARD_IDS,
  CARD_IDS,
  STATUS_IDS,
  TEST_USER_ID,
  WORK_PROJECTS_STATUS_IDS,
  createServiceRoleSupabaseClient,
  resetBoardNames,
  resetBoardSubtitles,
  resetRepoCards,
  resetStatusListNames,
  resetUserSettings,
} from '../helpers/db-query'

/** 50 characters, the longest name of a board, a column and the boards page, as one word. */
const FIFTY_LETTERS_WITHOUT_A_SPACE = 'W'.repeat(50)

/** 100 characters, the longest subtitle of a board and of the boards page, as one word. */
const HUNDRED_LETTERS_WITHOUT_A_SPACE = 'W'.repeat(100)

/** A repository name in snake_case: 65 characters and no hyphen to break at. */
const SNAKE_CASE_REPOSITORY_NAME =
  'a_very_long_repository_name_with_underscores_and_no_hyphen_at_all'

/** A small phone held upright: a dialog is as wide as this screen. */
const PHONE_VIEWPORT = { width: 375, height: 667 }

/**
 * Writes one column of one row, bypassing the app. The reset helpers of
 * `db-query.ts` put the seed values back after each test.
 * @param table - The table of the row.
 * @param id - The id of the row.
 * @param change - The column to write and its value.
 */
async function writeRow(
  table: 'board' | 'statuslist' | 'repocard',
  id: string,
  change: Record<string, string>,
): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from(table)
    .update(change)
    .eq('id', id)
  if (error) throw new Error(`writeRow(${table}) failed: ${error.message}`)
}

/**
 * Says where a control lies against the box it belongs to, and whether a
 * press on its middle reaches it.
 * @param box - The card, the column or another box the control belongs to.
 * @param controlSelector - CSS selector of the control inside the box.
 * @returns
 * - `beyondRightEdgePx`: how far the control ends right of the box (0 when inside)
 * - `isReachedByAPress`: whether the element at the control's middle is the control
 */
async function measureControl(
  box: Locator,
  controlSelector: string,
): Promise<{ beyondRightEdgePx: number; isReachedByAPress: boolean }> {
  return box.evaluate((element, selector) => {
    const control = element.querySelector(selector)
    if (!control) throw new Error(`no control matches ${selector}`)
    const boxRect = element.getBoundingClientRect()
    const controlRect = control.getBoundingClientRect()
    const elementAtMiddle = document.elementFromPoint(
      controlRect.left + controlRect.width / 2,
      controlRect.top + controlRect.height / 2,
    )
    return {
      beyondRightEdgePx: Math.max(
        0,
        Math.round(controlRect.right - boxRect.right),
      ),
      isReachedByAPress:
        elementAtMiddle !== null && control.contains(elementAtMiddle),
    }
  }, controlSelector)
}

/**
 * Says how a layer (a dialog, a list of options) lies on the screen and
 * whether anything in it is wider than the layer.
 * @param layer - The open dialog or list.
 * @returns
 * - `beyondScreenPx`: how far the layer reaches past the left or the right edge of the screen
 * - `hiddenWidthPx`: the width inside the layer that is cut off or can only be reached by scrolling it sideways
 */
async function measureLayer(
  layer: Locator,
): Promise<{ beyondScreenPx: number; hiddenWidthPx: number }> {
  return layer.evaluate((element) => {
    const layerRect = element.getBoundingClientRect()
    const screenWidthPx = document.documentElement.clientWidth
    return {
      beyondScreenPx: Math.max(
        0,
        Math.round(-layerRect.left),
        Math.round(layerRect.right - screenWidthPx),
      ),
      hiddenWidthPx: element.scrollWidth - element.clientWidth,
    }
  })
}

/**
 * Says how far the text of an element is drawn beyond the element's own box.
 * A word that cannot break stays one line and leaves the box that holds it.
 * @param element - The element that holds the text.
 * @returns The width of the text beyond the box in pixels, 0 when it fits.
 */
async function measureTextBeyondItsBox(element: Locator): Promise<number> {
  return element.evaluate((node) => node.scrollWidth - node.clientWidth)
}

/**
 * Says on how many lines the text of an element is drawn and where its
 * longest line ends. Reads the text itself, not the box around it: a word
 * that runs out of its box is still one line.
 * @param element - The element that holds the text.
 * @returns
 * - `lines`: the number of lines, 1 for a text that did not break
 * - `rightEdgePx`: the right end of the longest line, from the left edge of the screen
 */
async function measureTextLines(
  element: Locator,
): Promise<{ lines: number; rightEdgePx: number }> {
  return element.evaluate((node) => {
    const lineTops = new Set<number>()
    let rightEdgePx = 0
    const textNodes = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    while (textNodes.nextNode()) {
      const range = document.createRange()
      range.selectNodeContents(textNodes.currentNode)
      for (const rect of range.getClientRects()) {
        lineTops.add(Math.round(rect.top))
        rightEdgePx = Math.max(rightEdgePx, rect.right)
      }
    }
    return { lines: lineTops.size, rightEdgePx }
  })
}

/**
 * Opens the test board and waits for its first column. The columns are drawn
 * in the browser, so one on the page means that the page answers to clicks.
 * @param page - The page of the test.
 */
async function openTestBoard(page: Page): Promise<void> {
  await page.goto(`/board/${BOARD_IDS.testBoard}`)
  await expect(
    page.locator(`[data-status-column-id="${STATUS_IDS.pending}"]`),
  ).toBeVisible({ timeout: 15000 })
}

test.describe('Names without a place to break', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.afterEach(async () => {
    await resetBoardNames()
    await resetBoardSubtitles()
    await resetStatusListNames()
    await resetRepoCards()
    await resetUserSettings()
  })

  // Value: protects=the menu of a card ("Move to Another Board", "Remove from Board") can be reached with the mouse whatever the repository is called; fails_when=the title of a card cannot shrink below its longest piece, so a name in snake_case pushes the menu button out of the card and under the next column; why_new=every card of the seed has a short name with hyphens; seam=none; no_claim=how the broken title looks, and the keyboard, which reached the menu before
  test('keeps the menu button of a card inside the card when the repository name has no hyphen', async ({
    page,
  }) => {
    // Arrange
    await writeRow('repocard', CARD_IDS.card1, {
      repo_name: SNAKE_CASE_REPOSITORY_NAME,
    })

    // Act
    await openTestBoard(page)

    // Assert
    const card = page.locator(`[data-repo-card-id="${CARD_IDS.card1}"]`)
    await expect(card.getByTestId('repo-name')).toHaveText(
      'testuser/a_very_long_repository_name_with_underscores_and_no_hyphen_at_all',
    )
    expect(
      await measureControl(
        card,
        `[data-testid="overflow-menu-trigger-${CARD_IDS.card1}"]`,
      ),
    ).toEqual({ beyondRightEdgePx: 0, isReachedByAPress: true })
  })

  // Value: protects="Column options" (Edit Column, Delete Column) can be reached with the mouse whatever the column is called, and the color dot of the column keeps its size; fails_when=the title of a column cannot shrink below its longest word, so a name of one long word pushes the button out of the column, or the title that now gives way squeezes the dot beside it; why_new=every column of the seed has a short name; seam=none; no_claim=how the broken title looks
  test('keeps "Column options" inside the column, and the color dot 12px wide, when the column name is one word of 50 letters', async ({
    page,
  }) => {
    // Arrange
    await writeRow('statuslist', STATUS_IDS.pending, {
      name: FIFTY_LETTERS_WITHOUT_A_SPACE,
    })

    // Act
    await openTestBoard(page)

    // Assert
    const column = page.locator(
      `[data-status-column-id="${STATUS_IDS.pending}"]`,
    )
    await expect(column.getByRole('heading', { level: 2 })).toHaveText(
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    )
    expect(
      await measureControl(column, '[aria-label="Column options"]'),
    ).toEqual({ beyondRightEdgePx: 0, isReachedByAPress: true })
    // The dot stands right before the title
    expect(
      await column
        .getByRole('heading', { level: 2 })
        .evaluate(
          (title) =>
            title.previousElementSibling?.getBoundingClientRect().width,
        ),
    ).toBe(12)
  })

  for (const widthPx of [1280, 700]) {
    // Value: protects=Add Repositories, Add Column, Board Settings and Copy Link are on screen whatever the board and its subtitle are called, and the title and the subtitle stay inside their own boxes; fails_when=the title block in the header's row cannot get narrower than its longest word, so a name of one long word pushes all four buttons past the right edge of the screen, which does not scroll, or the word is drawn across the buttons; why_new=the seed boards have short names, and the tests of a long title use one with spaces; seam=none; no_claim=how the row divides its width for names that can break, which is as it was
    test(`keeps the four buttons of the board header on a ${widthPx}px screen when the name and the subtitle of the board are one long word each`, async ({
      page,
    }) => {
      // Arrange
      await writeRow('board', BOARD_IDS.testBoard, {
        name: FIFTY_LETTERS_WITHOUT_A_SPACE,
        subtitle: HUNDRED_LETTERS_WITHOUT_A_SPACE,
      })
      await page.setViewportSize({ width: widthPx, height: 800 })

      // Act
      await openTestBoard(page)

      // Assert
      for (const buttonName of [
        'Add Repositories',
        'Add Column',
        'Board Settings',
        'Copy Link',
      ]) {
        await expect(
          page.getByRole('button', { name: buttonName, exact: true }),
          `${buttonName} on a ${widthPx}px screen`,
        ).toBeInViewport({ ratio: 1 })
      }
      // ... and neither text is drawn beyond its own box, across the buttons
      expect({
        titleBeyondItsBoxPx: await measureTextBeyondItsBox(
          page.getByTestId('board-title'),
        ),
        subtitleBeyondItsBoxPx: await measureTextBeyondItsBox(
          page.getByTestId('board-subtitle'),
        ),
      }).toEqual({ titleBeyondItsBoxPx: 0, subtitleBeyondItsBoxPx: 0 })
    })
  }

  // Value: protects="Create Board" is on screen whatever title and subtitle the user gave the boards page, with room between the texts and the button, and the name of a board stays inside its card; fails_when=the block beside the button cannot get narrower than its longest word, so a title or a subtitle of one long word pushes the button past the right edge of the screen, or a board name of one long word runs out of its card; why_new=the tests of the title and the subtitle type short ones, and the seed boards have short names; seam=none; no_claim=how the broken texts look
  test('keeps "Create Board" on screen, 16px from the texts at least, and a board name inside its card, when each of them is one long word', async ({
    page,
  }) => {
    // Arrange
    await writeRow('board', BOARD_IDS.testBoard, {
      name: FIFTY_LETTERS_WITHOUT_A_SPACE,
    })
    const { error } = await createServiceRoleSupabaseClient()
      .from('user_settings')
      .upsert(
        {
          user_id: TEST_USER_ID,
          boards_page_title: FIFTY_LETTERS_WITHOUT_A_SPACE,
          boards_page_subtitle: HUNDRED_LETTERS_WITHOUT_A_SPACE,
        },
        { onConflict: 'user_id' },
      )
    expect(error).toBeNull()
    await page.setViewportSize({ width: 1280, height: 800 })

    // Act
    await page.goto('/boards')

    // Assert
    const title = page.getByTestId('boards-page-title')
    const subtitle = page.getByTestId('boards-page-subtitle')
    await expect(title).toHaveText(
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    )
    const createBoard = page.getByRole('link', { name: 'Create Board' })
    await expect(createBoard).toBeInViewport({ ratio: 1 })
    const buttonLeftPx = (await createBoard.boundingBox())?.x ?? 0
    const titleBox = await title.boundingBox()
    const subtitleBox = await subtitle.boundingBox()
    const textsRightPx = Math.max(
      (titleBox?.x ?? 0) + (titleBox?.width ?? 0),
      (subtitleBox?.x ?? 0) + (subtitleBox?.width ?? 0),
    )
    expect(Math.round(buttonLeftPx - textsRightPx)).toBeGreaterThanOrEqual(16)
    expect({
      titleBeyondItsBoxPx: await measureTextBeyondItsBox(title),
      subtitleBeyondItsBoxPx: await measureTextBeyondItsBox(subtitle),
      boardNameBeyondItsBoxPx: await measureTextBeyondItsBox(
        page.getByRole('heading', {
          level: 2,
          name: 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
        }),
      ),
    }).toEqual({
      titleBeyondItsBoxPx: 0,
      subtitleBeyondItsBoxPx: 0,
      boardNameBeyondItsBoxPx: 0,
    })
  })

  // Value: protects=a board whose name is one ordinary word of eleven letters, as the board has that #213 makes for the repositories set aside, shows it in one piece on a tablet; fails_when=the name of a board card may shrink to the room beside the star and the menu, 102px in a card of 216px, so the word loses its last letters to a second line; why_new=the long-name tests use a word no card can hold, and no test looked at a word that fits the card but not that room; seam=none; no_claim=a name of several words, which breaks between them as before, and a card where the star and the menu are always on screen
  test('keeps "Experiments" on one line in its board card on a 768px screen, where it runs on under the buttons of the card', async ({
    page,
  }) => {
    // Arrange
    await writeRow('board', BOARD_IDS.testBoard, { name: 'Experiments' })
    await page.setViewportSize({ width: 768, height: 1024 })

    // Act
    await page.goto('/boards')

    // Assert
    const card = page.getByTestId(`board-card-${BOARD_IDS.testBoard}`)
    const name = card.getByRole('heading', { level: 2, name: 'Experiments' })
    await expect(name).toBeVisible()
    const cardBox = await card.boundingBox()
    const starBox = await card
      .getByRole('button', {
        name: /^(Add|Remove) Experiments (to|from) favorites$/,
      })
      .boundingBox()
    const nameText = await measureTextLines(name)
    expect({
      cardWidthPx: Math.round(cardBox?.width ?? 0),
      nameLines: nameText.lines,
      // The word is wider than the room pr-16 leaves it: this is the case
      // that broke
      doesNameReachTheStar: nameText.rightEdgePx > (starBox?.x ?? Infinity),
      nameBeyondItsCardPx: Math.max(
        0,
        Math.round(
          nameText.rightEdgePx - ((cardBox?.x ?? 0) + (cardBox?.width ?? 0)),
        ),
      ),
    }).toEqual({
      cardWidthPx: 216,
      nameLines: 1,
      doesNameReachTheStar: true,
      nameBeyondItsCardPx: 0,
    })
  })

  // Value: protects=on a phone the title of the boards page is read in one piece and "Create Board" is whole on the screen; fails_when=the title stands beside the button, where a 375px screen leaves it 120px: an ordinary word of ten letters breaks in the middle, or, when the title may not shrink, pushes the button past the edge of the screen; why_new=the tests of this header ran on a wide screen, and the long-name test uses a word no line can hold; seam=none; no_claim=the header from 640px on, where title and button share a row, and how the subtitle wraps
  test('stands "Create Board" under the texts of the boards page on a phone, where a title of one ordinary word stays on one line', async ({
    page,
  }) => {
    // Arrange
    const { error } = await createServiceRoleSupabaseClient()
      .from('user_settings')
      .upsert(
        { user_id: TEST_USER_ID, boards_page_title: 'Dashboards' },
        { onConflict: 'user_id' },
      )
    expect(error).toBeNull()
    await page.setViewportSize(PHONE_VIEWPORT)

    // Act
    await page.goto('/boards')

    // Assert
    const title = page.getByTestId('boards-page-title')
    await expect(title).toHaveText('Dashboards')
    const createBoard = page.getByRole('link', { name: 'Create Board' })
    await expect(createBoard).toBeInViewport({ ratio: 1 })
    const subtitleBox = await page
      .getByTestId('boards-page-subtitle')
      .boundingBox()
    const buttonBox = await createBoard.boundingBox()
    const titleBox = await title.boundingBox()
    expect({
      titleLines: (await measureTextLines(title)).lines,
      buttonBelowTheTextsPx: Math.round(
        (buttonBox?.y ?? 0) -
          ((subtitleBox?.y ?? 0) + (subtitleBox?.height ?? 0)),
      ),
      // The title is a line as wide as the page; the button keeps its own
      // width under it
      isButtonNarrowerThanTheTitleLine:
        (buttonBox?.width ?? Infinity) < (titleBox?.width ?? 0),
    }).toEqual({
      titleLines: 1,
      buttonBelowTheTextsPx: 16,
      isButtonNarrowerThanTheTitleLine: true,
    })
  })

  // Value: protects=from 640px on "Create Board" stands where it stood, at the right end of the row of the title and level with the middle of the texts; fails_when=the header keeps the column of a phone on a wider screen, or its row no longer pushes the button to the right end or centers it; why_new=the header became a column below 640px, and no test said where the button stands above that; seam=none; no_claim=how the texts wrap in the row
  test('stands "Create Board" at the right end of the row of the title on a 640px screen', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 640, height: 800 })

    // Act
    await page.goto('/boards')

    // Assert
    const title = page.getByTestId('boards-page-title')
    await expect(title).toHaveText('My Boards')
    const titleBox = await title.boundingBox()
    const subtitleBox = await page
      .getByTestId('boards-page-subtitle')
      .boundingBox()
    const buttonBox = await page
      .getByRole('link', { name: 'Create Board' })
      .boundingBox()
    const textsTopPx = titleBox?.y ?? 0
    const textsBottomPx = (subtitleBox?.y ?? 0) + (subtitleBox?.height ?? 0)
    expect({
      // The page has 16px of padding on a 640px screen
      buttonRightEdgePx: Math.round(
        (buttonBox?.x ?? 0) + (buttonBox?.width ?? 0),
      ),
      buttonMiddleBelowTheMiddleOfTheTextsPx: Math.round(
        (buttonBox?.y ?? 0) +
          (buttonBox?.height ?? 0) / 2 -
          (textsTopPx + textsBottomPx) / 2,
      ),
    }).toEqual({
      buttonRightEdgePx: 624,
      buttonMiddleBelowTheMiddleOfTheTextsPx: 0,
    })
  })

  test.describe('in a dialog on a 375px phone', () => {
    test.use({ viewport: PHONE_VIEWPORT })

    test.beforeEach(async () => {
      // Both boards: the move dialog names the other one as its destination
      for (const boardId of [BOARD_IDS.testBoard, BOARD_IDS.workProjects]) {
        await writeRow('board', boardId, {
          name: FIFTY_LETTERS_WITHOUT_A_SPACE,
        })
      }
    })

    test.afterEach(async () => {
      // One test renames the first column of the destination: seed.sql calls it Backlog
      await writeRow('statuslist', WORK_PROJECTS_STATUS_IDS.backlog, {
        name: 'Backlog',
      })
    })

    // Value: protects=the board settings stay as wide as a phone's screen whatever the board is called; fails_when=the description, which names the board, cannot break the name, so the one column of the dialog grows and the dialog scrolls sideways; why_new=board-settings-narrow-viewport.spec.ts opens the dialog for a board with a short name; seam=none; no_claim=the four tabs, which that spec walks through
    test('breaks the board name in the description of the board settings', async ({
      page,
    }) => {
      // Arrange
      await openTestBoard(page)

      // Act
      await page.getByRole('button', { name: 'Board Settings' }).click()

      // Assert
      const dialog = page.getByRole('dialog')
      await expect(
        dialog.getByText(
          'Configure settings for "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"',
        ),
      ).toBeVisible()
      expect(await measureLayer(dialog)).toEqual({
        beyondScreenPx: 0,
        hiddenWidthPx: 0,
      })
    })

    // Value: protects=the question before a board is deleted can be read on a phone whatever the board is called; fails_when=an alert dialog cannot break the name it quotes and scrolls sideways; why_new=the confirmation is another component than the dialog, with classes of its own; seam=none; no_claim=that the board is deleted, which board-settings.spec.ts and boards.spec.ts check
    test('breaks the board name in the confirmation of Delete Board', async ({
      page,
    }) => {
      // Arrange
      await openTestBoard(page)
      await page.getByRole('button', { name: 'Board Settings' }).click()
      const settings = page.getByRole('dialog')
      await settings.getByRole('tab', { name: 'Danger Zone' }).click()

      // Act
      await settings.getByRole('button', { name: 'Delete Board' }).click()

      // Assert
      const confirmation = page.getByRole('alertdialog')
      await expect(confirmation).toBeVisible()
      expect(await measureLayer(confirmation)).toEqual({
        beyondScreenPx: 0,
        hiddenWidthPx: 0,
      })
    })

    // Value: protects="Move to Another Board" and its two lists stay as wide as a phone's screen when the destination and its column have names of one long word, so every choice can be read; fails_when=the Board select makes the dialog scroll sideways, or a list, which is drawn outside the dialog and does not inherit its classes, is as wide as its longest name and ends beyond the screen, or the list fits and cuts the name off, or the color dot of a column is squeezed; why_new=the tests of the move dialog use the seed boards; seam=none; no_claim=the select of the dialog itself, which shows one line of the chosen name and cuts the rest
    test('keeps the move dialog and its lists of boards and columns as wide as the screen when their names are one long word', async ({
      page,
    }) => {
      // Arrange
      await writeRow('statuslist', WORK_PROJECTS_STATUS_IDS.backlog, {
        name: FIFTY_LETTERS_WITHOUT_A_SPACE,
      })
      await openTestBoard(page)
      await page
        .locator(`[data-testid="overflow-menu-trigger-${CARD_IDS.card1}"]`)
        .click()

      // Act
      await page
        .locator(`[data-testid="move-to-another-board-${CARD_IDS.card1}"]`)
        .click()

      // Assert: the dialog
      const dialog = page.getByRole('dialog')
      const boardSelect = dialog.getByRole('combobox', { name: 'Board' })
      await expect(boardSelect).toHaveText(
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
      )
      expect(await measureLayer(dialog)).toEqual({
        beyondScreenPx: 0,
        hiddenWidthPx: 0,
      })

      // Act: the list of boards
      await boardSelect.click()

      // Assert: the list ends on the screen, and the name is not cut off
      // inside it
      const list = page.getByRole('listbox')
      const firstOption = list.getByRole('option').first()
      await expect(list.getByRole('option')).toHaveCount(1)
      await expect
        .poll(async () => ({
          ...(await measureLayer(list)),
          nameBeyondItsOptionPx: await measureTextBeyondItsBox(firstOption),
        }))
        .toEqual({
          beyondScreenPx: 0,
          hiddenWidthPx: 0,
          nameBeyondItsOptionPx: 0,
        })
      await page.keyboard.press('Escape')
      await expect(list).toBeHidden()

      // Act: the list of columns
      await dialog.getByRole('combobox', { name: 'Column' }).click()

      // Assert: the list, and the color dot of its first column
      await expect(list.getByRole('option')).toHaveCount(3)
      await expect
        .poll(async () => ({
          ...(await measureLayer(list)),
          nameBeyondItsOptionPx: await measureTextBeyondItsBox(firstOption),
          colorDotWidthPx: await firstOption
            .locator('span.rounded-full')
            .evaluate((dot) => dot.getBoundingClientRect().width),
        }))
        .toEqual({
          beyondScreenPx: 0,
          hiddenWidthPx: 0,
          nameBeyondItsOptionPx: 0,
          colorDotWidthPx: 12,
        })
    })
  })
})
