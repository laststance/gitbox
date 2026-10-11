/**
 * Public Board Validation Schema
 *
 * Shape of the JSON document the `get_public_board(p_slug)` database function
 * returns for a shared board. The function builds the document by hand in
 * SQL, so nothing ties it to the TypeScript types: this schema is that tie.
 * Keys it does not list are dropped, so a field the function gained by
 * mistake would still not reach the visitor.
 */

import { z } from 'zod'

/** A column of a shared board, with the `statuslist` column names. */
const publicBoardColumnSchema = z.object({
  id: z.string(),
  board_id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  order: z.number(),
  grid_row: z.number(),
  grid_col: z.number(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
})

/** A card of a shared board: the `repocard` columns without `user_id`. */
const publicBoardCardSchema = z.object({
  id: z.string(),
  board_id: z.string(),
  status_id: z.string(),
  repo_owner: z.string(),
  repo_name: z.string(),
  order: z.number(),
  meta: z.json(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
})

/**
 * Schema for the document returned by `get_public_board(p_slug)`. Of the
 * board itself only what the shared page shows comes back: its name and
 * subtitle.
 *
 * @example
 * publicBoardRowSchema.safeParse({
 *   board: { name: 'Shared', subtitle: null },
 *   statuslist: [],
 *   repocard: [],
 * }) // => { success: true, data: { board, statuslist: [], repocard: [] } }
 * publicBoardRowSchema.safeParse({ board: {} }) // => { success: false, error: ... }
 */
export const publicBoardRowSchema = z.object({
  board: z.object({
    name: z.string(),
    subtitle: z.string().nullable(),
  }),
  statuslist: z.array(publicBoardColumnSchema),
  repocard: z.array(publicBoardCardSchema),
})
