/**
 * Viewport Breakpoints
 */

/**
 * Media query that matches a viewport narrower than Tailwind's `md`
 * breakpoint (768px): a phone, upright or on its side. Below it
 * {@link Sidebar} is always its icon rail, because the open sidebar (256px)
 * leaves a 375px screen 119px for the page.
 *
 * Kept in step with the `max-md:` classes of {@link Sidebar}, which give the
 * rail its width before the page has hydrated.
 */
export const NARROW_VIEWPORT_MEDIA_QUERY = '(max-width: 767.98px)'
