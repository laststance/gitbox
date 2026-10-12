/**
 * Text color of a character counter that is close to its limit: the note of
 * a card, the comment on a card, the name and the subtitle of a board.
 *
 * Orange 800 on the light themes and orange 300 on the dark ones. Each is at
 * least 4.5:1 on the background of every theme, which
 * src/tests/unit/styles/comment-counter-contrast.test.ts computes. Orange
 * 500, which these counters had, is between 2.4:1 and 2.9:1 on the light
 * ones.
 *
 * @example
 * <p className={isNearLimit ? `text-sm ${NEAR_LIMIT_COUNTER_TEXT_CLASS}` : 'text-muted-foreground text-sm'}>
 *   {count}/{max}
 * </p>
 */
export const NEAR_LIMIT_COUNTER_TEXT_CLASS =
  'text-orange-800 dark:text-orange-300'
