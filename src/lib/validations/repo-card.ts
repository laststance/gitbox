/**
 * RepoCard Validation Schemas
 *
 * Zod schemas for validating repository payloads sent to RepoCard server actions.
 */

import { z } from 'zod'

import { GITHUB_NAME_SEGMENT } from '@/lib/constants/regex'

/** Maximum number of repositories accepted by one "Add Repositories" request */
export const MAX_REPOSITORIES_PER_ADD = 100

/** Shown to the user when one request holds more than {@link MAX_REPOSITORIES_PER_ADD} repositories */
export const TOO_MANY_REPOSITORIES_MESSAGE = `Add at most ${MAX_REPOSITORIES_PER_ADD} repositories at once`

/**
 * Caps for the display fields copied into `repocard.meta`.
 *
 * They match what GitHub will actually send (a description of 350 characters,
 * 20 topics of 50, visibility `public` / `private` / `internal`) with room for
 * a language name and an ISO timestamp. A longer or non-text value is a
 * hand-crafted request: the card renders these fields as text. The same caps are enforced by `repocard_meta_display` for a direct
 * insert.
 */
export const REPO_DESCRIPTION_MAX_LENGTH = 350
export const REPO_LANGUAGE_MAX_LENGTH = 100
export const REPO_TOPIC_MAX_LENGTH = 50
export const REPO_TOPIC_MAX_COUNT = 20
export const REPO_UPDATED_AT_MAX_LENGTH = 40

const githubNameSegmentSchema = z.string().regex(GITHUB_NAME_SEGMENT)

/**
 * Schema for one repository passed to {@link addRepositoriesToBoard}.
 *
 * The payload comes from the browser. Owner and name are echoed in messages
 * and stored on the card. Description, language, topics, stars, visibility
 * and the updated date are stored in `repocard.meta` and rendered on the
 * caller's board, so a non-text or oversized value is refused before any
 * query. Fields the card does not store (`full_name`,
 * `avatar_url`, ...) are accepted and dropped. Description and language may
 * be null, topics may be missing, and visibility may be `internal`: that is
 * what GitHub sends.
 *
 * @example
 * addRepositoriesRequestSchema.safeParse([{ id: 1, name: 'gitbox', owner: { login: 'laststance' }, description: null, visibility: 'internal' }])
 * // => { success: true }
 * addRepositoriesRequestSchema.safeParse([{ id: 1, name: '<script>', owner: { login: 'x' } }])
 * // => { success: false }
 * addRepositoriesRequestSchema.safeParse([{ id: 1, name: 'gitbox', owner: { login: 'x' }, description: { text: 'no' } }])
 * // => { success: false }
 */
export const addRepositoriesRequestSchema = z
  .array(
    z.object({
      id: z.number().int().positive(),
      name: githubNameSegmentSchema,
      owner: z.object({ login: githubNameSegmentSchema }),
      description: z
        .string()
        .max(REPO_DESCRIPTION_MAX_LENGTH)
        .nullable()
        .optional(),
      language: z.string().max(REPO_LANGUAGE_MAX_LENGTH).nullable().optional(),
      topics: z
        .array(z.string().max(REPO_TOPIC_MAX_LENGTH))
        .max(REPO_TOPIC_MAX_COUNT)
        .nullable()
        .optional(),
      stargazers_count: z.number().int().nonnegative().optional(),
      visibility: z.enum(['public', 'private', 'internal']).optional(),
      updated_at: z.iso
        .datetime({ offset: true })
        .max(REPO_UPDATED_AT_MAX_LENGTH)
        .optional(),
    }),
  )
  .min(1)
  .max(MAX_REPOSITORIES_PER_ADD, TOO_MANY_REPOSITORIES_MESSAGE)
