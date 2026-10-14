/**
 * Project Info Data Access E2E Tests
 *
 * What the database itself does with the project info of a card (its note,
 * links and comment), asked directly through the REST API the way any
 * signed-in browser can, without the server actions in front of it.
 *
 * The migration of issue #213 dropped the two row level security policies of
 * `projectinfo` and created them again without the branch for the table it
 * removed. A policy written wrong there, `USING (true)` for one, would hand
 * every note to every signed-in user, and no page test would notice: the app
 * only ever asks for the notes of its own cards.
 *
 * These tests talk to the database, not to a page.
 */

import { expect, test } from '@playwright/test'

import {
  BOARD_IDS,
  CARD_IDS,
  OTHER_USER,
  WORK_PROJECTS_STATUS_IDS,
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

/** Fixed id of the card one test puts on Work Projects and deletes again. */
const CARD_TO_DELETE_ID = '00000000-0000-0000-0000-0000000003c1'

/**
 * Take away the project info this spec puts on cards: card 5 of the test user
 * and the two cards of the second user. seed.sql gives none of them any. The
 * card of {@link CARD_TO_DELETE_ID} goes too, with whatever hangs on it, when
 * its test stopped before deleting it.
 */
async function removeProjectInfoOfProbeCards(): Promise<void> {
  const serviceRole = createServiceRoleSupabaseClient()
  const { error } = await serviceRole
    .from('projectinfo')
    .delete()
    .in('repo_card_id', [
      CARD_IDS.card5,
      OTHER_USER.testRepoCardId,
      OTHER_USER.privateProjectCardId,
    ])
  if (error) {
    throw new Error(`removeProjectInfoOfProbeCards failed: ${error.message}`)
  }
  const { error: cardError } = await serviceRole
    .from('repocard')
    .delete()
    .eq('id', CARD_TO_DELETE_ID)
  if (cardError) {
    throw new Error(
      `removeProjectInfoOfProbeCards failed on the card: ${cardError.message}`,
    )
  }
}

/**
 * Put a note on a card of the second user, with the service role: the test
 * user must never be able to do that themselves.
 * @param cardId - A card of {@link OTHER_USER}.
 */
async function giveOtherUsersCardANote(cardId: string): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('projectinfo')
    .insert({ repo_card_id: cardId, note: 'note of the other user' })
  if (error) {
    throw new Error(`giveOtherUsersCardANote failed: ${error.message}`)
  }
}

/**
 * The notes stored for a card, read with the service role so row level
 * security cannot hide a row.
 * @param cardId - Card to look up.
 * @returns The `note` of every project info row of that card.
 */
async function readNotesOfCard(cardId: string): Promise<(string | null)[]> {
  const { data, error } = await createServiceRoleSupabaseClient()
    .from('projectinfo')
    .select('note')
    .eq('repo_card_id', cardId)
  if (error) {
    throw new Error(`readNotesOfCard failed: ${error.message}`)
  }
  return data.map((row) => row.note)
}

test.describe('Project info data access', () => {
  // Before as well as after: a row left by an interrupted run would make the
  // first insert fail (one project info row per card)
  test.beforeEach(removeProjectInfoOfProbeCards)
  test.afterEach(removeProjectInfoOfProbeCards)

  test('a signed-in user adds, reads, changes and deletes the project info of their own card', async () => {
    // Arrange: card 5 of the test user has no project info yet
    const testUser = createTestUserSupabaseClient()

    // Act
    const added = await testUser
      .from('projectinfo')
      .insert({ repo_card_id: CARD_IDS.card5, note: 'first draft' })
      .select('note')
    const read = await testUser
      .from('projectinfo')
      .select('note')
      .eq('repo_card_id', CARD_IDS.card5)
    const changed = await testUser
      .from('projectinfo')
      .update({ note: 'second draft' })
      .eq('repo_card_id', CARD_IDS.card5)
      .select('note')
    const notesAfterChange = await readNotesOfCard(CARD_IDS.card5)
    const deleted = await testUser
      .from('projectinfo')
      .delete()
      .eq('repo_card_id', CARD_IDS.card5)
      .select('note')

    // Assert
    expect(added.error).toBeNull()
    expect(added.data).toEqual([{ note: 'first draft' }])
    expect(read.error).toBeNull()
    expect(read.data).toEqual([{ note: 'first draft' }])
    expect(changed.error).toBeNull()
    expect(changed.data).toEqual([{ note: 'second draft' }])
    expect(notesAfterChange).toEqual(['second draft'])
    expect(deleted.error).toBeNull()
    expect(deleted.data).toEqual([{ note: 'second draft' }])
    expect(await readNotesOfCard(CARD_IDS.card5)).toEqual([])
  })

  test("a signed-in user cannot read the project info of another user's card", async () => {
    // Arrange
    await giveOtherUsersCardANote(OTHER_USER.privateProjectCardId)
    const testUser = createTestUserSupabaseClient()

    // Act
    const askedByCard = await testUser
      .from('projectinfo')
      .select('note')
      .eq('repo_card_id', OTHER_USER.privateProjectCardId)
    const everythingVisible = await testUser
      .from('projectinfo')
      .select('repo_card_id')

    // Assert: no error, simply nothing of the other user to see, asked for
    // by card or not
    expect(askedByCard.error).toBeNull()
    expect(askedByCard.data).toEqual([])
    expect(everythingVisible.error).toBeNull()
    expect(
      everythingVisible.data?.map((row) => row.repo_card_id),
    ).not.toContain('00000000-0000-0000-0000-000000000312')
  })

  test("a signed-in user cannot change or delete the project info of another user's card", async () => {
    // Arrange
    await giveOtherUsersCardANote(OTHER_USER.privateProjectCardId)
    const testUser = createTestUserSupabaseClient()

    // Act
    const changed = await testUser
      .from('projectinfo')
      .update({ note: 'overwritten' })
      .eq('repo_card_id', OTHER_USER.privateProjectCardId)
      .select('id')
    const deleted = await testUser
      .from('projectinfo')
      .delete()
      .eq('repo_card_id', OTHER_USER.privateProjectCardId)
      .select('id')

    // Assert: both touch no row, and the note is what it was
    expect(changed.error).toBeNull()
    expect(changed.data).toEqual([])
    expect(deleted.error).toBeNull()
    expect(deleted.data).toEqual([])
    expect(await readNotesOfCard(OTHER_USER.privateProjectCardId)).toEqual([
      'note of the other user',
    ])
  })

  test("a signed-in user cannot add project info to another user's card", async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const added = await testUser
      .from('projectinfo')
      .insert({ repo_card_id: OTHER_USER.testRepoCardId, note: 'planted' })

    // Assert: refused by row level security
    expect(added.error?.code).toBe('42501')
    expect(await readNotesOfCard(OTHER_USER.testRepoCardId)).toEqual([])
  })

  test('project info that belongs to no card is refused, whoever writes it', async () => {
    // Arrange
    const serviceRole = createServiceRoleSupabaseClient()
    const testUser = createTestUserSupabaseClient()

    // Act
    const writtenByServiceRole = await serviceRole
      .from('projectinfo')
      .insert({ note: 'belongs to no card' })
    const writtenByUser = await testUser
      .from('projectinfo')
      .insert({ note: 'belongs to no card' })

    // Assert: the service role is not held by row level security and meets
    // the NOT NULL column (23502); a user is stopped by the policy first
    expect(writtenByServiceRole.error?.code).toBe('23502')
    expect(writtenByUser.error?.code).toBe('42501')
    const rowsWithoutCard = await serviceRole
      .from('projectinfo')
      .select('id', { count: 'exact', head: true })
      .eq('note', 'belongs to no card')
    expect(rowsWithoutCard.error).toBeNull()
    expect(rowsWithoutCard.count).toBe(0)
  })

  test('a card holds one row of project info: a second row is refused', async () => {
    // Arrange: card 5 of the test user gets its project info
    const testUser = createTestUserSupabaseClient()
    const firstRow = await testUser
      .from('projectinfo')
      .insert({ repo_card_id: CARD_IDS.card5, note: 'the only row' })
    expect(firstRow.error).toBeNull()

    // Act
    const secondRow = await testUser
      .from('projectinfo')
      .insert({ repo_card_id: CARD_IDS.card5, note: 'a second row' })

    // Assert
    expect(secondRow.error?.code).toBe('23505')
    expect(secondRow.error?.message).toContain('projectinfo_repo_card_id_key')
    expect(await readNotesOfCard(CARD_IDS.card5)).toEqual(['the only row'])
  })

  test('deleting a card deletes its project info with it', async () => {
    // Arrange: a card of the test user on Work Projects, with a note
    const placed = await createServiceRoleSupabaseClient()
      .from('repocard')
      .insert({
        id: CARD_TO_DELETE_ID,
        board_id: BOARD_IDS.workProjects,
        status_id: WORK_PROJECTS_STATUS_IDS.backlog,
        repo_owner: 'laststance',
        repo_name: 'project-info-probe',
        order: 0,
        meta: {},
      })
    expect(placed.error).toBeNull()
    const testUser = createTestUserSupabaseClient()
    const noted = await testUser
      .from('projectinfo')
      .insert({ repo_card_id: CARD_TO_DELETE_ID, note: 'leaves with the card' })
    expect(noted.error).toBeNull()

    // Act: the user removes the card from the board
    const removed = await testUser
      .from('repocard')
      .delete()
      .eq('id', CARD_TO_DELETE_ID)
      .select('id')

    // Assert: the card is gone and nothing of its project info is left
    expect(removed.error).toBeNull()
    expect(removed.data).toEqual([
      { id: '00000000-0000-0000-0000-0000000003c1' },
    ])
    expect(await readNotesOfCard(CARD_TO_DELETE_ID)).toEqual([])
  })

  test('a visitor without an account reads no project info', async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const projectInfo = await visitor.from('projectinfo').select('id')

    // Assert
    expect(projectInfo.error).toBeNull()
    expect(projectInfo.data).toEqual([])
  })
})
