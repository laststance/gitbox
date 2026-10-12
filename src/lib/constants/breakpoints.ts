/**
 * Viewport Breakpoints
 */

/**
 * Media query that matches a viewport narrower than Tailwind's `md`
 * breakpoint (48rem, which is 768px at the usual font size): a phone, upright
 * or on its side. Below it {@link Sidebar} is its icon rail and opens over
 * the page, not beside it, because the open sidebar (256px) leaves a 375px
 * screen 119px for the page.
 *
 * Written as the `max-md:` classes of {@link Sidebar} are compiled, in rem.
 * Those classes give the rail its width before the page has hydrated, and a
 * query in px disagrees with them for a reader whose browser font size is
 * not 16px: the labels were then rendered and cut off at 64px.
 */
export const NARROW_VIEWPORT_MEDIA_QUERY = 'not all and (min-width: 48rem)'
