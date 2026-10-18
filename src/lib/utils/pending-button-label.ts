/**
 * Idle or pending label for a submit control.
 *
 * Forms used to write `{isPending ? 'Creating…' : 'Create Board'}` by hand.
 * {@link pendingButtonLabel} keeps the Title Case idle command and the
 * ellipsis pending form in one place. Callers that show a spinner still
 * render that icon themselves.
 *
 * @param isPending - Whether the request is in flight.
 * @param idle - Title Case command, e.g. `Create Board`.
 * @param pending - Ellipsis form, e.g. `Creating…`.
 * @returns {@link pending} when in flight, otherwise {@link idle}.
 *
 * @example
 * pendingButtonLabel(true, 'Create Board', 'Creating…')
 */
export function pendingButtonLabel(
  isPending: boolean,
  idle: string,
  pending: string,
): string {
  return isPending ? pending : idle
}
