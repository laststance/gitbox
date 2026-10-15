/**
 * The card a held-row link asks the destination board to show.
 *
 * The Add Repositories picker links "On <board>" at `/board/<id>?card=<card id>`.
 * {@link useRevealLinkedCard} reads that parameter once the board's own cards
 * are on screen, scrolls the card into view and focuses it, then drops the
 * parameter so a later refresh does not move the focus again.
 */

/** Search parameter of {@link linkedCardHref}. */
export const LINKED_CARD_SEARCH_PARAM = 'card'

/**
 * A repocard id. Anything else is ignored, so the value cannot change the
 * selector that finds the card.
 */
const CARD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Address of the board that holds a card, naming the card to reveal.
 *
 * Called by {@link HeldRepositoryList} when it builds the "On <board>" link.
 *
 * @param boardId - Board that holds the card.
 * @param cardId - Id of that card.
 * @returns `/board/<boardId>?card=<cardId>`.
 * @example
 * linkedCardHref('board-1', '00000000-0000-4000-8000-000000000001')
 * // => '/board/board-1?card=00000000-0000-4000-8000-000000000001'
 */
export function linkedCardHref(boardId: string, cardId: string): string {
  const params = new URLSearchParams()
  params.set(LINKED_CARD_SEARCH_PARAM, cardId)
  return `/board/${encodeURIComponent(boardId)}?${params.toString()}`
}

/**
 * Scrolls a card into the middle of the board and focuses it.
 *
 * Exists so someone who followed "On <board>" lands on the card instead of
 * looking for it. Called by {@link useRevealLinkedCard}. A column mounts
 * every card (columns are not virtualized), so a card below the fold is in
 * the document and `scrollIntoView` moves the board's scroller. When a
 * column later mounts only the visible cards, the caller must retry until
 * the element is there.
 *
 * @param cardId - Card id from the link. A value that is not a UUID is ignored.
 * @returns Whether a card on the page was revealed.
 * @example
 * revealCardOnBoard('00000000-0000-4000-8000-000000000001') // => true
 */
export function revealCardOnBoard(cardId: string): boolean {
  // A raw query value must not be interpolated into a selector.
  if (!CARD_ID_PATTERN.test(cardId)) return false

  const card = document.querySelector(`[data-repo-card-id="${cardId}"]`)
  if (!(card instanceof HTMLElement)) return false

  card.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' })
  card.focus({ preventScroll: true })
  return true
}

/**
 * Drops the card parameter so a later refresh does not move the focus again.
 *
 * Called by {@link useRevealLinkedCard} after one attempt on the hydrated
 * board. Uses `replaceState`, as the picker's return parameter does, so the
 * page does not navigate again.
 *
 * @example
 * forgetLinkedCardSearchParam()
 */
export function forgetLinkedCardSearchParam(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(LINKED_CARD_SEARCH_PARAM)) return

  url.searchParams.delete(LINKED_CARD_SEARCH_PARAM)
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}
