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
