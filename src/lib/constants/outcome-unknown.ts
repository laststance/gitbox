/**
 * Color of a message whose write may have happened: a create or a move
 * that got no answer. Red would say the action failed.
 *
 * Used by {@link CreateBoardForm}, {@link CreateDestinationBoardForm},
 * {@link MoveToAnotherBoardDialog} and {@link MoveHereDialog}. A refusal,
 * an invalid name, a load failure and a stale page stay destructive.
 *
 * @example
 * <p className={isUnknown ? OUTCOME_UNKNOWN_TEXT_CLASS : 'text-destructive'}>
 *   {message}
 * </p>
 */
export const OUTCOME_UNKNOWN_TEXT_CLASS = 'text-warning'

/**
 * Box around {@link OUTCOME_UNKNOWN_TEXT_CLASS}, the same tint pattern as
 * `border-destructive/20 bg-destructive/10`.
 */
export const OUTCOME_UNKNOWN_BOX_CLASS = 'border-warning/20 bg-warning/10'
