/**
 * Project Info Data Access E2E Tests
 *
 * What the database itself does with the project info of a repository (its
 * note, links and comment), asked directly through the REST API the way any
 * signed-in browser can, without the server actions in front of it.
 *
 * Since issue #216 a row belongs to a user and a repository, not to a card:
 * it stays when the card goes and comes back with the card added again.
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
  TEST_USER_ID,
  WORK_PROJECTS_STATUS_IDS,
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

/** The repository of card 5 of the test user: no project info in the seed. */
const USE_APP_STATE = 'laststance/use-app-state'

/** Fixed id of the card one test puts on Work Projects, deletes and adds again. */
const PROBE_CARD_ID = '00000000-0000-0000-0000-0000000003c1'

/** The repository of {@link PROBE_CARD_ID}: on no board of the seed. */
const PROBE_REPOSITORY = {
  repo_owner: 'laststance',
  repo_name: 'project-info-probe',
} as const

/**
 * Take away the project info this spec writes: for laststance/use-app-state
 * (card 5 of the test user), for the probe repository, and every row of the
 * second user. seed.sql gives none of them any. The probe card goes too, when
 * its test stopped before deleting it.
 */
async function removeProjectInfoOfProbeRepositories(): Promise<void> {
  const serviceRole = createServiceRoleSupabaseClient()
  const { error } = await serviceRole
    .from('projectinfo')
    .delete()
    .eq('user_id', TEST_USER_ID)
    .in('repo_key', [USE_APP_STATE, 'laststance/project-info-probe'])
  if (error) {
    throw new Error(
      `removeProjectInfoOfProbeRepositories failed: ${error.message}`,
    )
  }
  const { error: otherUserError } = await serviceRole
    .from('projectinfo')
    .delete()
    .eq('user_id', OTHER_USER.id)
  if (otherUserError) {
    throw new Error(
      `removeProjectInfoOfProbeRepositories failed for the second user: ${otherUserError.message}`,
    )
  }
  const { error: slashOwnerError } = await serviceRole
    .from('projectinfo')
    .delete()
    .eq('user_id', TEST_USER_ID)
    .eq('repo_owner', 'last/stance')
  if (slashOwnerError) {
    throw new Error(
      `removeProjectInfoOfProbeRepositories failed on a slash row: ${slashOwnerError.message}`,
    )
  }
  const { error: slashNameError } = await serviceRole
    .from('projectinfo')
    .delete()
    .eq('user_id', TEST_USER_ID)
    .eq('repo_name', 'slash/probe')
  if (slashNameError) {
    throw new Error(
      `removeProjectInfoOfProbeRepositories failed on a slash row: ${slashNameError.message}`,
    )
  }
  const { error: cardError } = await serviceRole
    .from('repocard')
    .delete()
    .in('id', [
      PROBE_CARD_ID,
      '00000000-0000-0000-0000-0000000003c2',
      '00000000-0000-0000-0000-0000000003c3',
    ])
  if (cardError) {
    throw new Error(
      `removeProjectInfoOfProbeRepositories failed on the card: ${cardError.message}`,
    )
  }
}

/**
 * Note a repository of the second user, with the service role: the test user
 * must never be able to do that themselves. The second user has a card of
 * testuser/private-project; the test user has none.
 */
async function giveOtherUsersRepositoryANote(): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('projectinfo')
    .insert({
      user_id: OTHER_USER.id,
      repo_owner: 'testuser',
      repo_name: 'private-project',
      note: 'note of the other user',
    })
  if (error) {
    throw new Error(`giveOtherUsersRepositoryANote failed: ${error.message}`)
  }
}

/**
 * The notes one user stores for one repository, read with the service role so
 * row level security cannot hide a row.
 * @param userId - Whose rows to read.
 * @param repoKey - `owner/name` in lowercase.
 * @returns The `note` of every project info row of that user and repository.
 */
async function readNotesOfRepository(
  userId: string,
  repoKey: string,
): Promise<(string | null)[]> {
  const { data, error } = await createServiceRoleSupabaseClient()
    .from('projectinfo')
    .select('note')
    .eq('user_id', userId)
    .eq('repo_key', repoKey)
  if (error) {
    throw new Error(`readNotesOfRepository failed: ${error.message}`)
  }
  return data.map((row) => row.note)
}

/**
 * The project info of laststance/use-app-state for the test user, read with
 * the service role so a column the upsert did not send is still visible.
 * @returns The note, links, comment and color of every matching row.
 */
async function readProjectInfoOfUseAppState(): Promise<
  {
    note: string | null
    links: unknown
    comment: string | null
    comment_color: string | null
  }[]
> {
  const { data, error } = await createServiceRoleSupabaseClient()
    .from('projectinfo')
    .select('note, links, comment, comment_color')
    .eq('user_id', TEST_USER_ID)
    .eq('repo_key', USE_APP_STATE)
  if (error) {
    throw new Error(`readProjectInfoOfUseAppState failed: ${error.message}`)
  }
  return data
}

/**
 * Put the probe card on Work Projects with the service role, as adding it
 * from the picker would.
 */
async function placeProbeCard(): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('repocard')
    .insert({
      id: PROBE_CARD_ID,
      board_id: BOARD_IDS.workProjects,
      status_id: WORK_PROJECTS_STATUS_IDS.backlog,
      ...PROBE_REPOSITORY,
      order: 0,
      meta: {},
    })
  if (error) {
    throw new Error(`placeProbeCard failed: ${error.message}`)
  }
}

test.describe('Project info data access', () => {
  // Before as well as after: a row left by an interrupted run would make the
  // first insert fail (one project info row per user and repository)
  test.beforeEach(removeProjectInfoOfProbeRepositories)
  test.afterEach(removeProjectInfoOfProbeRepositories)

  test('a signed-in user adds, reads, changes and deletes the project info of a repository on their board', async () => {
    // Arrange: laststance/use-app-state (card 5) has no project info yet
    const testUser = createTestUserSupabaseClient()

    // Act: the user id comes from the session, never from the browser
    const added = await testUser
      .from('projectinfo')
      .insert({
        repo_owner: 'laststance',
        repo_name: 'use-app-state',
        note: 'first draft',
      })
      .select('user_id, repo_key, note')
    const read = await testUser
      .from('projectinfo')
      .select('note')
      .eq('repo_key', USE_APP_STATE)
    const changed = await testUser
      .from('projectinfo')
      .update({ note: 'second draft' })
      .eq('repo_key', USE_APP_STATE)
      .select('note')
    const notesAfterChange = await readNotesOfRepository(
      TEST_USER_ID,
      USE_APP_STATE,
    )
    const deleted = await testUser
      .from('projectinfo')
      .delete()
      .eq('repo_key', USE_APP_STATE)
      .select('note')

    // Assert
    expect(added.error).toBeNull()
    expect(added.data).toEqual([
      {
        user_id: '00000000-0000-0000-0000-000000000001',
        repo_key: USE_APP_STATE,
        note: 'first draft',
      },
    ])
    expect(read.error).toBeNull()
    expect(read.data).toEqual([{ note: 'first draft' }])
    expect(changed.error).toBeNull()
    expect(changed.data).toEqual([{ note: 'second draft' }])
    expect(notesAfterChange).toEqual(['second draft'])
    expect(deleted.error).toBeNull()
    expect(deleted.data).toEqual([{ note: 'second draft' }])
    expect(await readNotesOfRepository(TEST_USER_ID, USE_APP_STATE)).toEqual([])
  })

  test('a card reads the project info of its repository, written in another letter case', async () => {
    // Arrange: the note is stored for "LastStance/Use-App-State"
    const testUser = createTestUserSupabaseClient()
    const noted = await testUser.from('projectinfo').insert({
      repo_owner: 'LastStance',
      repo_name: 'Use-App-State',
      note: 'written in capitals',
    })
    expect(noted.error).toBeNull()

    // Act: card 5 is laststance/use-app-state
    const card = await testUser
      .from('repocard')
      .select('id, projectinfo(note)')
      .eq('id', CARD_IDS.card5)

    // Assert: one object, not a list
    expect(card.error).toBeNull()
    expect(card.data).toEqual([
      {
        id: '00000000-0000-0000-0000-000000000305',
        projectinfo: { note: 'written in capitals' },
      },
    ])
  })

  test("a signed-in user cannot read another user's project info", async () => {
    // Arrange
    await giveOtherUsersRepositoryANote()
    const testUser = createTestUserSupabaseClient()

    // Act
    const askedByRepository = await testUser
      .from('projectinfo')
      .select('note')
      .eq('repo_key', 'testuser/private-project')
    const everythingVisible = await testUser
      .from('projectinfo')
      .select('user_id')

    // Assert: no error, simply nothing of the other user to see, asked for
    // by repository or not
    expect(askedByRepository.error).toBeNull()
    expect(askedByRepository.data).toEqual([])
    expect(everythingVisible.error).toBeNull()
    expect(everythingVisible.data?.map((row) => row.user_id)).not.toContain(
      '00000000-0000-0000-0000-000000000002',
    )
  })

  test("another user's card of a repository the test user noted embeds nothing of that note", async () => {
    // Arrange: both users have a card of testuser/test-repo; seed.sql gives
    // the test user's repository a note
    const testUser = createTestUserSupabaseClient()

    // Act: the service role, which row level security does not hold, reads
    // the other user's card with its project info
    const otherUsersCard = await createServiceRoleSupabaseClient()
      .from('repocard')
      .select('id, projectinfo(note)')
      .eq('id', OTHER_USER.testRepoCardId)
    const ownRead = await testUser
      .from('projectinfo')
      .select('note')
      .eq('repo_key', 'testuser/test-repo')

    // Assert: a card meets only the rows of its own user
    expect(otherUsersCard.error).toBeNull()
    expect(otherUsersCard.data).toEqual([
      { id: '00000000-0000-0000-0000-000000000311', projectinfo: null },
    ])
    expect(ownRead.data).toEqual([{ note: 'Important project notes here' }])
  })

  test("a signed-in user cannot change or delete another user's project info", async () => {
    // Arrange
    await giveOtherUsersRepositoryANote()
    const testUser = createTestUserSupabaseClient()

    // Act
    const changed = await testUser
      .from('projectinfo')
      .update({ note: 'overwritten' })
      .eq('repo_key', 'testuser/private-project')
      .select('id')
    const deleted = await testUser
      .from('projectinfo')
      .delete()
      .eq('repo_key', 'testuser/private-project')
      .select('id')

    // Assert: both touch no row, and the note is what it was
    expect(changed.error).toBeNull()
    expect(changed.data).toEqual([])
    expect(deleted.error).toBeNull()
    expect(deleted.data).toEqual([])
    expect(
      await readNotesOfRepository(OTHER_USER.id, 'testuser/private-project'),
    ).toEqual(['note of the other user'])
  })

  test('a signed-in user cannot write project info in the name of another user', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const added = await testUser.from('projectinfo').insert({
      user_id: OTHER_USER.id,
      repo_owner: 'testuser',
      repo_name: 'private-project',
      note: 'planted',
    })

    // Assert: refused by row level security
    expect(added.error?.code).toBe('42501')
    expect(
      await readNotesOfRepository(OTHER_USER.id, 'testuser/private-project'),
    ).toEqual([])
  })

  test('a signed-in user cannot store project info for a repository that has no card of theirs', async () => {
    // Arrange: the second user has a card of testuser/private-project, the
    // test user has none
    const testUser = createTestUserSupabaseClient()

    // Act
    const added = await testUser.from('projectinfo').insert({
      repo_owner: 'testuser',
      repo_name: 'private-project',
      note: 'never placed',
    })

    // Assert: refused by row level security
    expect(added.error?.code).toBe('42501')
    expect(
      await readNotesOfRepository(TEST_USER_ID, 'testuser/private-project'),
    ).toEqual([])
  })

  test('project info that names no repository is refused, whoever writes it', async () => {
    // Arrange
    const serviceRole = createServiceRoleSupabaseClient()
    const testUser = createTestUserSupabaseClient()

    // Act
    const writtenByServiceRole = await serviceRole
      .from('projectinfo')
      .insert({ user_id: TEST_USER_ID, note: 'names no repository' })
    const writtenByUser = await testUser
      .from('projectinfo')
      .insert({ note: 'names no repository' })

    // Assert: the service role is not held by row level security and meets
    // the NOT NULL column (23502); a user is stopped by the policy first
    expect(writtenByServiceRole.error?.code).toBe('23502')
    expect(writtenByUser.error?.code).toBe('42501')
    const rowsWithoutRepository = await serviceRole
      .from('projectinfo')
      .select('id', { count: 'exact', head: true })
      .eq('note', 'names no repository')
    expect(rowsWithoutRepository.error).toBeNull()
    expect(rowsWithoutRepository.count).toBe(0)
  })

  test('a repository holds one row of project info per user, whatever the letter case: a second row is refused', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()
    const firstRow = await testUser.from('projectinfo').insert({
      repo_owner: 'laststance',
      repo_name: 'use-app-state',
      note: 'the only row',
    })
    expect(firstRow.error).toBeNull()

    // Act
    const secondRow = await testUser.from('projectinfo').insert({
      repo_owner: 'LastStance',
      repo_name: 'USE-APP-STATE',
      note: 'a second row',
    })

    // Assert
    expect(secondRow.error?.code).toBe('23505')
    expect(secondRow.error?.message).toContain(
      'projectinfo_unique_repo_per_user',
    )
    expect(await readNotesOfRepository(TEST_USER_ID, USE_APP_STATE)).toEqual([
      'the only row',
    ])
  })

  test('deleting a card keeps the project info of its repository, and the card added again reads it', async () => {
    // Arrange: a card of the test user on Work Projects, with a note
    await placeProbeCard()
    const testUser = createTestUserSupabaseClient()
    const noted = await testUser
      .from('projectinfo')
      .insert({ ...PROBE_REPOSITORY, note: 'kept with the repository' })
    expect(noted.error).toBeNull()

    // Act: the user removes the card from the board ...
    const removed = await testUser
      .from('repocard')
      .delete()
      .eq('id', PROBE_CARD_ID)
      .select('id')
    const notesWithoutCard = await readNotesOfRepository(
      TEST_USER_ID,
      'laststance/project-info-probe',
    )
    // ... and adds the repository again
    await placeProbeCard()
    const cardAddedAgain = await testUser
      .from('repocard')
      .select('id, projectinfo(note)')
      .eq('id', PROBE_CARD_ID)

    // Assert
    expect(removed.error).toBeNull()
    expect(removed.data).toEqual([
      { id: '00000000-0000-0000-0000-0000000003c1' },
    ])
    expect(notesWithoutCard).toEqual(['kept with the repository'])
    expect(cardAddedAgain.error).toBeNull()
    expect(cardAddedAgain.data).toEqual([
      {
        id: '00000000-0000-0000-0000-0000000003c1',
        projectinfo: { note: 'kept with the repository' },
      },
    ])
  })

  test('accepts a note whose saved document is longer than 20000 characters when its text is not', async () => {
    // Arrange: markup past the old limit, two characters of text
    const testUser = createTestUserSupabaseClient()
    const note = `[{"type":"p","padding":"${'x'.repeat(20000)}","children":[{"text":"hi"}]}]`

    // Act
    const added = await testUser.from('projectinfo').insert({
      repo_owner: 'laststance',
      repo_name: 'use-app-state',
      note,
    })

    // Assert
    expect(note.length).toBeGreaterThan(20000)
    expect(added.error).toBeNull()
    expect(await readNotesOfRepository(TEST_USER_ID, USE_APP_STATE)).toEqual([
      note,
    ])
  })

  test('refuses a note whose text is longer than 20000 characters', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()
    const note = `[{"type":"p","children":[{"text":"${'y'.repeat(20001)}"}]}]`

    // Act
    const added = await testUser.from('projectinfo').insert({
      repo_owner: 'laststance',
      repo_name: 'use-app-state',
      note,
    })

    // Assert
    expect(added.error?.code).toBe('23514')
    expect(await readNotesOfRepository(TEST_USER_ID, USE_APP_STATE)).toEqual([])
  })

  test('a comment save keeps the note and the links', async () => {
    // Arrange: a row that already holds a note, links, a comment and a color
    const testUser = createTestUserSupabaseClient()
    const seeded = await testUser.from('projectinfo').insert({
      repo_owner: 'laststance',
      repo_name: 'use-app-state',
      note: 'the note',
      links: [
        {
          type: 'npm',
          url: 'https://www.npmjs.com/package/use-app-state',
        },
      ],
      comment: 'old comment',
      comment_color: 'blue',
    })
    expect(seeded.error).toBeNull()

    // Act: the payload of updateCommentCore when no color is given
    const saved = await testUser.from('projectinfo').upsert(
      {
        repo_owner: 'laststance',
        repo_name: 'use-app-state',
        comment: 'new comment',
      },
      { onConflict: 'user_id,repo_key' },
    )

    // Assert
    expect(saved.error).toBeNull()
    expect(await readProjectInfoOfUseAppState()).toEqual([
      {
        note: 'the note',
        links: [
          {
            url: 'https://www.npmjs.com/package/use-app-state',
            type: 'npm',
          },
        ],
        comment: 'new comment',
        comment_color: 'blue',
      },
    ])
  })

  test('a note save keeps the comment and the color', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()
    const seeded = await testUser.from('projectinfo').insert({
      repo_owner: 'laststance',
      repo_name: 'use-app-state',
      comment: 'kept comment',
      comment_color: 'green',
    })
    expect(seeded.error).toBeNull()

    // Act: the payload of upsertProjectInfoCore when no comment is given
    const saved = await testUser.from('projectinfo').upsert(
      {
        repo_owner: 'laststance',
        repo_name: 'use-app-state',
        note: 'the note',
        links: [
          {
            type: 'npm',
            url: 'https://www.npmjs.com/package/use-app-state',
          },
        ],
      },
      { onConflict: 'user_id,repo_key' },
    )

    // Assert
    expect(saved.error).toBeNull()
    expect(await readProjectInfoOfUseAppState()).toEqual([
      {
        note: 'the note',
        links: [
          {
            url: 'https://www.npmjs.com/package/use-app-state',
            type: 'npm',
          },
        ],
        comment: 'kept comment',
        comment_color: 'green',
      },
    ])
  })

  test('a color-only save makes a row with the column defaults', async () => {
    // Arrange: use-app-state has a card and no project info (beforeEach)
    const testUser = createTestUserSupabaseClient()

    // Act: the payload of updateCommentColorCore
    const saved = await testUser.from('projectinfo').upsert(
      {
        repo_owner: 'laststance',
        repo_name: 'use-app-state',
        comment_color: 'blue',
      },
      { onConflict: 'user_id,repo_key' },
    )

    // Assert: note and comment have no default, links default to {}
    expect(saved.error).toBeNull()
    expect(await readProjectInfoOfUseAppState()).toEqual([
      {
        note: null,
        links: {},
        comment: null,
        comment_color: 'blue',
      },
    ])
  })

  test('deleting an account deletes the project info of that account', async () => {
    // Arrange: a throwaway user, never one of the seed
    const admin = createServiceRoleSupabaseClient()
    const created = await admin.auth.admin.createUser({
      email: `projectinfo-cascade-${crypto.randomUUID()}@gitbox.dev`,
      password: 'throwaway-password-1',
      email_confirm: true,
    })
    expect(created.error).toBeNull()
    const userId = created.data.user?.id
    if (typeof userId !== 'string') {
      throw new Error('createUser returned no id')
    }

    try {
      const noted = await admin
        .from('projectinfo')
        .insert({
          user_id: userId,
          repo_owner: 'laststance',
          repo_name: 'cascade-probe',
          note: 'goes with the account',
        })
        .select('id')
      expect(noted.error).toBeNull()
      expect(noted.data).toHaveLength(1)

      // Act
      const deleted = await admin.auth.admin.deleteUser(userId)

      // Assert
      expect(deleted.error).toBeNull()
      const left = await admin
        .from('projectinfo')
        .select('id')
        .eq('user_id', userId)
      expect(left.error).toBeNull()
      expect(left.data).toEqual([])
    } finally {
      await admin.auth.admin.deleteUser(userId)
    }
  })

  test('a visitor without an account cannot call /rpc/projectinfo', async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const called = await visitor.rpc('projectinfo', { repocard: {} })

    // Assert: PostgREST does not offer the computed relationship as an RPC,
    // so a visitor gets no row
    expect(called.data).toBeNull()
    expect(called.error?.code).toBe('PGRST202')
  })

  test.each([
    {
      column: 'owner',
      id: '00000000-0000-0000-0000-0000000003c2',
      repo_owner: 'last/stance',
      repo_name: 'slash-probe',
    },
    {
      column: 'name',
      id: '00000000-0000-0000-0000-0000000003c3',
      repo_owner: 'laststance',
      repo_name: 'slash/probe',
    },
  ])(
    'refuses a card whose $column contains a slash',
    async ({ id, repo_owner, repo_name }) => {
      // Arrange
      const testUser = createTestUserSupabaseClient()

      // Act
      const added = await testUser.from('repocard').insert({
        id,
        board_id: BOARD_IDS.workProjects,
        status_id: WORK_PROJECTS_STATUS_IDS.backlog,
        repo_owner,
        repo_name,
        order: 0,
        meta: {},
      })

      // Assert
      expect(added.error?.code).toBe('23514')
      const left = await createServiceRoleSupabaseClient()
        .from('repocard')
        .select('id')
        .eq('id', id)
      expect(left.error).toBeNull()
      expect(left.data).toEqual([])
    },
  )

  test.each([
    {
      column: 'owner',
      repo_owner: 'last/stance',
      repo_name: 'slash-probe',
    },
    {
      column: 'name',
      repo_owner: 'laststance',
      repo_name: 'slash/probe',
    },
  ])(
    'refuses project info whose $column contains a slash',
    async ({ repo_owner, repo_name }) => {
      // Arrange: the service role bypasses row level security, not the check
      const admin = createServiceRoleSupabaseClient()

      // Act
      const added = await admin.from('projectinfo').insert({
        user_id: TEST_USER_ID,
        repo_owner,
        repo_name,
        note: 'must not be stored',
      })

      // Assert
      expect(added.error?.code).toBe('23514')
      const left = await admin
        .from('projectinfo')
        .select('id')
        .eq('user_id', TEST_USER_ID)
        .eq('repo_owner', repo_owner)
        .eq('repo_name', repo_name)
      expect(left.error).toBeNull()
      expect(left.data).toEqual([])
    },
  )

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
