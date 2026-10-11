/**
 * Unit Tests: the 404 page of a shared board link
 *
 * A visitor who follows a dead share link usually has no account. The root
 * 404 page offered them "Go to Boards", which only leads to the login page.
 *
 * @see src/app/public/[slug]/not-found.tsx
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import PublicBoardNotFound from '@/app/public/[slug]/not-found'

describe('shared board link that shows no board', () => {
  test('says the shared board is unavailable and why that can be', () => {
    // Arrange / Act
    render(<PublicBoardNotFound />)

    // Assert
    expect(screen.getByRole('heading', { name: '404' })).toBeVisible()
    expect(screen.getByText("This shared board isn't available.")).toBeVisible()
    expect(
      screen.getByText(
        'The link may be mistyped, or the owner stopped sharing the board.',
      ),
    ).toBeVisible()
  })

  test('offers the home page, not the board list that asks a visitor to sign in', () => {
    // Arrange / Act
    render(<PublicBoardNotFound />)

    // Assert
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.queryByRole('link', { name: 'Go to Boards' })).toBeNull()
  })
})
