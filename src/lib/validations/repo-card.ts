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

const githubNameSegmentSchema = z
  .string()
  .regex(GITHUB_NAME_SEGMENT, 'Invalid GitHub name')

/**
 * Schema for the identity fields of the repositories passed to
 * `addRepositoriesToBoard`. The payload comes from the browser, and the owner
 * and name are echoed back in messages and stored on the card, so they are
 * checked before any query runs. Other fields (stars, topics, ...) are display
 * metadata and are not validated here.
 *
 * @example
 * addRepositoriesRequestSchema.safeParse([{ id: 1, name: 'gitbox', owner: { login: 'laststance' } }])
 * // => { success: true }
 * addRepositoriesRequestSchema.safeParse([{ id: 1, name: '<script>', owner: { login: 'x' } }])
 * // => { success: false }
 * addRepositoriesRequestSchema.safeParse([])
 * // => { success: false }
 */
export const addRepositoriesRequestSchema = z
  .array(
    z.object({
      id: z.number().int().positive(),
      name: githubNameSegmentSchema,
      owner: z.object({ login: githubNameSegmentSchema }),
    }),
  )
  .min(1, 'Select at least one repository')
  .max(MAX_REPOSITORIES_PER_ADD, TOO_MANY_REPOSITORIES_MESSAGE)
