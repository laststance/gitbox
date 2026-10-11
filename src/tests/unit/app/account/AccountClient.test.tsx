/**
 * Unit Tests: the Account Data summary of the account page
 *
 * The summary counts what the user keeps in GitBox. A repository lives on a
 * board as a card, so it has two tiles: Boards and Repository Cards, side by
 * side in a two-column grid.
 *
 * @see src/app/account/AccountClient.tsx
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { AccountClient } from '@/app/account/AccountClient'
import { toUserId } from '@/lib/types/brands'

vi.mock('@/lib/actions/auth', () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}))

const userProfile = {
  id: toUserId('user-1'),
  userName: 'octocat',
  linkedSince: '2026-01-15T00:00:00.000Z',
} as const

describe('AccountClient data summary', () => {
  test('shows the number of boards and the number of repository cards the user has', () => {
    // Arrange
    const accountData = { boardsCount: 5, cardsCount: 27 }

    // Act
    render(
      <AccountClient userProfile={userProfile} accountData={accountData} />,
    )

    // Assert
    const boardsTile = screen.getByText('Boards').parentElement
    const repositoryCardsTile =
      screen.getByText('Repository Cards').parentElement
    expect(boardsTile).toBeVisible()
    expect(boardsTile).toHaveTextContent('5Boards')
    expect(repositoryCardsTile).toBeVisible()
    expect(repositoryCardsTile).toHaveTextContent('27Repository Cards')
  })

  test('lays the Boards and Repository Cards tiles out as the two columns of one grid', () => {
    // Arrange
    const accountData = { boardsCount: 0, cardsCount: 0 }

    // Act
    render(
      <AccountClient userProfile={userProfile} accountData={accountData} />,
    )

    // Assert
    const tileGrid = screen.getByText('Boards').parentElement?.parentElement
    expect(tileGrid).toHaveClass('grid-cols-2')
    expect(tileGrid?.children).toHaveLength(2)
    expect(tileGrid?.children[0]).toHaveTextContent('Boards')
    expect(tileGrid?.children[1]).toHaveTextContent('Repository Cards')
  })
})
