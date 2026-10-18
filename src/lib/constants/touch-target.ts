/**
 * Shared painted size and coarse-pointer hit box for icon triggers.
 *
 * Card, comment, and column menus were 24px. A finger needs 44px. These
 * strings are the only enlargement recipe those surfaces may use:
 * paint 36px ({@link ICON_TRIGGER_PAINTED_CLASS}), then grow the hit box
 * to 44×44 on `pointer: coarse` without changing the painted box.
 *
 * Dialog Close is already `absolute`. It takes
 * {@link COARSE_HIT_TARGET_AFTER_CLASS} only, never
 * {@link COARSE_HIT_TARGET_CLASS}, so `relative` cannot drop it out of
 * the corner.
 *
 * @example
 * ```ts
 * <button className={ICON_TRIGGER_CLASS} aria-label="Card actions" />
 * ```
 */
export const ICON_TRIGGER_PAINTED_CLASS = 'size-9 p-0'

/**
 * The `::after` half of the 44×44 coarse hit box. No `relative`.
 *
 * Use this on a control that is already `absolute`, such as Dialog Close.
 */
export const COARSE_HIT_TARGET_AFTER_CLASS =
  "pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:h-11 pointer-coarse:after:w-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"

/**
 * In-flow coarse hit box: `relative` plus {@link COARSE_HIT_TARGET_AFTER_CLASS}.
 */
export const COARSE_HIT_TARGET_CLASS = `relative ${COARSE_HIT_TARGET_AFTER_CLASS}`

/**
 * Painted 36×36 icon trigger plus the in-flow coarse hit box.
 */
export const ICON_TRIGGER_CLASS = `${ICON_TRIGGER_PAINTED_CLASS} ${COARSE_HIT_TARGET_CLASS}`
