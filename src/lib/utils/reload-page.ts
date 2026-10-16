/**
 * Loads the page again from the server, as the browser's reload button does.
 *
 * Exists for the notices of a save, a move or a board creation that got no
 * answer in time. The board itself is read with `GET /api/boards/[id]` when
 * a write got no answer, so that read does not wait. A fetch of the list of
 * boards is still a Server Action, and one of those waits behind a request
 * that never answers. A reload does not wait: it drops what is on its way
 * and shows what the server has.
 * Offered by {@link reportUnconfirmedBoardSave},
 * {@link MoveToAnotherBoardDialog}, {@link CreateDestinationBoardForm} and
 * {@link CreateBoardForm}.
 *
 * @example
 * <Button onClick={reloadPage}>Reload page</Button>
 */
export function reloadPage(): void {
  window.location.reload()
}
