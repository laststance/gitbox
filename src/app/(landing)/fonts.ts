import { Source_Serif_4 } from 'next/font/google'

/**
 * Display face for landing `h1`/`h2` only.
 *
 * Loaded from {@link GitBoxLandingPage} so signed-in layouts do not download it.
 * Headings take `font-[family-name:var(--font-landing-display)]`; body copy
 * stays the system stack on `body`.
 */
export const landingDisplay = Source_Serif_4({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-landing-display',
})
