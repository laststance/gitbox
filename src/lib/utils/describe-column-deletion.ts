/**
 * Words the Delete Column confirmation for a column and the cards in it.
 *
 * Shown by the board page when "Delete Column" is chosen. What cannot be
 * undone comes first, then what is kept, in the order of the Delete Board
 * dialogs. The cards go with the column; the note, links and comment of their
 * repositories stay for when they are added again (issue #216).
 *
 * @param columnTitle - The column's name, as the user typed it.
 * @param cardCount - How many cards the column holds.
 * @returns The dialog's description.
 * @example
 * describeColumnDeletion('Done', 0)
 * // => 'Are you sure you want to delete "Done"? This action cannot be undone.'
 * describeColumnDeletion('Done', 1)
 * // => '... This will also remove 1 card in this column. The note, links and comment of its repository are kept for when you add it again.'
 */
export function describeColumnDeletion(
  columnTitle: string,
  cardCount: number,
): string {
  const question = `Are you sure you want to delete "${columnTitle}"? This action cannot be undone.`
  // An empty column takes nothing with it
  if (cardCount === 0) return question
  // One card has one repository: "its", not "their"
  if (cardCount === 1) {
    return `${question} This will also remove 1 card in this column. The note, links and comment of its repository are kept for when you add it again.`
  }
  return `${question} This will also remove ${cardCount} cards in this column. The notes, links and comments of their repositories are kept for when you add them again.`
}

/** The column name and the sentence the Delete Column dialog is showing. */
interface HeldColumnDeletion {
  title: string
  description: string
}

/**
 * Keeps the Delete Column sentence while the dialog fades out.
 *
 * Cancel and Delete clear the column at once, and {@link AlertDialogContent}
 * stays on screen for its exit (200ms). The board page builds the sentence
 * from the column that is still there. Once that column is gone it would
 * show an empty name and no card count. The page calls this on every render
 * and stores `held` until the next opening.
 *
 * @param isOpen - Whether the confirmation is open.
 * @param live - The column being deleted, or null once it is gone.
 * @param held - The column stored from the last render that had one.
 * @returns The column to show, and the column to store.
 * @example
 * const open = holdColumnDeletionDescription(true, { title: 'Done', description }, { title: '', description: '' })
 * holdColumnDeletionDescription(false, null, open.held).shown.description
 * // still names "Done" and its cards
 */
export function holdColumnDeletionDescription(
  isOpen: boolean,
  live: HeldColumnDeletion | null,
  held: HeldColumnDeletion,
): { shown: HeldColumnDeletion; held: HeldColumnDeletion } {
  // While the dialog is open the sentence follows the column on screen
  if (isOpen && live !== null) return { shown: live, held: live }
  return { shown: held, held }
}
