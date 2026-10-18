/**
 * Text color of a character counter that is close to its limit: the note of
 * a card, the comment on a card, the name and the subtitle of a board.
 *
 * `--warning` of the active theme. Each theme's value is at least 4.5:1 on
 * the page background, which
 * src/tests/unit/styles/comment-counter-contrast.test.ts computes. The
 * comment counter stands on a chip of that background, because no single
 * warning passes on every comment tint.
 *
 * @example
 * <p className={isNearLimit ? `text-sm ${NEAR_LIMIT_COUNTER_TEXT_CLASS}` : 'text-muted-foreground text-sm'}>
 *   {count}/{max}
 * </p>
 */
export const NEAR_LIMIT_COUNTER_TEXT_CLASS = 'text-warning'
