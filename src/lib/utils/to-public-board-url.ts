import { PUBLIC_BOARD_ROUTE_PREFIX } from '@/lib/constants/routes'

/**
 * Builds the link that opens a shared board for anyone, signed in or not.
 * Exists so the board header's "Copy Link" and the share section of the board
 * settings hand out the same address. Called by {@link BoardPageClient} and
 * {@link BoardSettingsDialog}.
 *
 * @param origin - Origin of the app, e.g. `window.location.origin`.
 * @param shareSlug - The board's share slug.
 * @returns The absolute URL of the board's read-only public page.
 * @example
 * toPublicBoardUrl('https://gitbox-laststance.vercel.app', 'a1b2c3d4e5f6')
 * // => 'https://gitbox-laststance.vercel.app/public/a1b2c3d4e5f6'
 */
export const toPublicBoardUrl = (
  origin: string,
  shareSlug: string,
): `${string}${typeof PUBLIC_BOARD_ROUTE_PREFIX}${string}` =>
  `${origin}${PUBLIC_BOARD_ROUTE_PREFIX}${shareSlug}`
