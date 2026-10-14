'use client'

import { memo } from 'react'

import { useMounted } from '@/hooks/use-mounted'

/**
 * How {@link LocalDate} spells a date: `numeric` is 1/31/2024, `long` is
 * January 31, 2024.
 */
type LocalDateStyle = 'numeric' | 'long'

const DATE_STYLE_OPTIONS = {
  numeric: { year: 'numeric', month: 'numeric', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
} as const satisfies Record<LocalDateStyle, Intl.DateTimeFormatOptions>

interface LocalDateProps {
  /** The moment to show, as the database returns it (ISO 8601 with an offset) */
  isoDate: string
  /** How the date is spelled */
  dateStyle: LocalDateStyle
}

/**
 * A date in the user's time zone that renders the same on the server and in the browser.
 *
 * The server renders a page in its own time zone (UTC on Vercel), the browser
 * in the user's. A date formatted in both places differed for anything made
 * between the two midnights, and React threw the server's markup away (error
 * #418 on /boards, seen on production for a board made at 22:59 UTC). Until
 * the page has hydrated, both sides spell the date in UTC; then the browser
 * spells it where the user is. Used by {@link BoardCard} for the day a board
 * was made and by {@link AccountClient} for the day the account was linked.
 *
 * @param isoDate - The moment to show.
 * @param dateStyle - `numeric` or `long`.
 * @returns A `time` element whose text is the date in the browser's time zone
 *   once the page has hydrated, and in UTC before.
 *
 * @example
 * ```tsx
 * // In Los Angeles, after hydration: 12/31/2023 (the server sent 1/1/2024)
 * <LocalDate isoDate="2024-01-01T00:00:00+00:00" dateStyle="numeric" />
 * ```
 */
export const LocalDate = memo(function LocalDate({
  isoDate,
  dateStyle,
}: LocalDateProps) {
  const isMounted = useMounted()
  // The server and the hydrating browser agree on UTC, whatever their zones
  const timeZone = isMounted ? undefined : 'UTC'

  return (
    <time dateTime={isoDate}>
      {new Date(isoDate).toLocaleDateString('en-US', {
        ...DATE_STYLE_OPTIONS[dateStyle],
        timeZone,
      })}
    </time>
  )
})
