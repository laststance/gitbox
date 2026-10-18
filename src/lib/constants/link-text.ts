/**
 * Theme-colored text on a surface (`--background`, `--card`, `--muted`).
 *
 * `--link` of the active theme. Each theme's value is at least 4.5:1 on
 * those surfaces and on the 10% / 20% primary tint, which
 * src/tests/unit/styles/link-color-contrast.test.ts computes. Do not use
 * this on a comment tint: Save there is `text-foreground`.
 *
 * Hover and group-hover must be the full utilities `hover:text-link` and
 * `group-hover:text-link` written in source so Tailwind emits them. Do not
 * write `hover:${LINK_TEXT_CLASS}`.
 *
 * @example
 * <a className={`${LINK_TEXT_CLASS} hover:text-link hover:underline`}>Terms</a>
 */
export const LINK_TEXT_CLASS = 'text-link'
