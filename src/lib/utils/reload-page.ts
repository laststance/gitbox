/**
 * Loads the page again from the server, as the browser's reload button does.
 *
 * Exists for the notices of a save or a move that got no answer in time.
 * Next.js sends Server Actions and `router.refresh()` one after another, so a
 * fetch of the board waits behind a request that never answers. A reload
 * does not wait: it drops what is on its way and shows what the server has.
 * Offered by {@link reportUnconfirmedBoardSave} and
 * {@link MoveToAnotherBoardDialog}.
 *
 * @example
 * <Button onClick={reloadPage}>Reload page</Button>
 */
export function reloadPage(): void {
  window.location.reload()
}
