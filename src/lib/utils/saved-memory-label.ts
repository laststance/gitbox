import type { SavedRepositoryMemory } from '@/lib/actions/saved-repository-memories'

/**
 * Names what a repository on no board brings back when it is added again.
 *
 * Shown in the Add Repositories picker beside the stars and the language of
 * the repository (issue #216). Only the parts that exist are named, in the
 * order of the Note dialog.
 *
 * @param memory - What is saved for the repository.
 * @returns `Saved: ` and the saved parts joined by commas.
 * @example
 * formatSavedMemoryLabel({ identifier: 'a/b', hasNote: true, linkCount: 3, hasComment: true })
 * // => 'Saved: note, 3 links, comment'
 * formatSavedMemoryLabel({ identifier: 'a/b', hasNote: false, linkCount: 1, hasComment: false })
 * // => 'Saved: 1 link'
 */
export function formatSavedMemoryLabel(memory: SavedRepositoryMemory): string {
  const savedParts: string[] = []
  if (memory.hasNote) savedParts.push('note')
  // "1 link", "2 links"
  if (memory.linkCount > 0) {
    savedParts.push(
      `${memory.linkCount} ${memory.linkCount === 1 ? 'link' : 'links'}`,
    )
  }
  if (memory.hasComment) savedParts.push('comment')
  return `Saved: ${savedParts.join(', ')}`
}
