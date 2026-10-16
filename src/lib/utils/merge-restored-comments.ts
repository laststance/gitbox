import type { CommentData } from '@/lib/actions/project-info-core'

/**
 * Puts the comments the page loaded over comments restored while it was open.
 *
 * A repository added on this page brings its comment back before the next
 * load, and that comment is not in the page the server sent. A later load
 * has the comment the database holds. The restored one must not hide it:
 * the board would keep showing the comment from the moment the card was
 * added. Called by {@link BoardPageClient} for the comments the cards read.
 *
 * @param serverComments - Comments on the page the server just sent.
 * @param restoredComments - Comments of cards added since that page was sent.
 * @returns The comments to show. A card only the restored map has keeps that comment.
 * @example
 * mergeRestoredComments(
 *   { 'card-1': { comment: 'from the server', color: 'blue' } },
 *   { 'card-1': { comment: 'from the add', color: 'primary' } },
 * )
 * // => { 'card-1': { comment: 'from the server', color: 'blue' } }
 */
export function mergeRestoredComments(
  serverComments: Record<string, CommentData>,
  restoredComments: Record<string, CommentData>,
): Record<string, CommentData> {
  return { ...restoredComments, ...serverComments }
}
