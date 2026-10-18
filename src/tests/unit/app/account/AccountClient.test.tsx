/**
 * Unit Tests: the Account Data summary of the account page
 *
 * The summary counts what the user keeps in GitBox. A repository lives on a
 * board as a card, so it has two cells: Boards and Repository Cards. That
 * they stand side by side is checked in a browser
 * (e2e/logged-in/account-profile.spec.ts); happy-dom does no layout.
 *
 * @see src/app/account/AccountClient.tsx
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { AccountClient } from '@/app/account/AccountClient'
import AccountLoading from '@/app/account/loading'
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
    const boardsCell = screen.getByTestId('account-stat-boards')
    const repositoryCardsCell = screen.getByTestId('account-stat-cards')
    expect(boardsCell).toBeVisible()
    expect(boardsCell).toHaveTextContent('5Boards')
    expect(repositoryCardsCell).toBeVisible()
    expect(repositoryCardsCell).toHaveTextContent('27Repository Cards')
  })

  test('shows the Boards cell first, the Repository Cards cell second and no third one', () => {
    // Arrange
    const accountData = { boardsCount: 0, cardsCount: 0 }

    // Act
    render(
      <AccountClient userProfile={userProfile} accountData={accountData} />,
    )

    // Assert
    const cellGrid = screen.getByTestId('account-stat-boards').parentElement
    expect(cellGrid?.children).toHaveLength(2)
    expect(cellGrid?.children[0]).toHaveTextContent('Boards')
    expect(cellGrid?.children[1]).toHaveTextContent('Repository Cards')
  })

  test('says deleting the account deletes the notes, links and comments too', () => {
    // Arrange
    const accountData = { boardsCount: 1, cardsCount: 1 }

    // Act
    render(
      <AccountClient userProfile={userProfile} accountData={accountData} />,
    )

    // Assert
    expect(
      screen.getByText(
        'Deleting your account will permanently remove all your boards, cards, notes, links, comments, and settings. This action cannot be undone.',
      ),
    ).toBeVisible()
  })

  test('the loading skeleton stands in the same column as the loaded page, so the page does not jump when the data arrives', () => {
    // Arrange
    const accountData = { boardsCount: 0, cardsCount: 0 }

    // Act
    const { container: skeleton } = render(<AccountLoading />)
    const { container: page } = render(
      <AccountClient userProfile={userProfile} accountData={accountData} />,
    )

    // Assert: the classes that set the width and the padding of the column
    expect(skeleton.firstElementChild?.className).toBe(
      'container mx-auto max-w-2xl px-4 py-8',
    )
    expect(page.firstElementChild?.className).toBe(
      'container mx-auto max-w-2xl px-4 py-8',
    )
  })

  test('AccountClient and its skeleton do not import Card', () => {
    // Arrange
    const client = readFileSync(
      join(process.cwd(), 'src/app/account/AccountClient.tsx'),
      'utf8',
    )
    const loading = readFileSync(
      join(process.cwd(), 'src/app/account/loading.tsx'),
      'utf8',
    )

    // Assert
    expect(client).not.toContain('@/components/ui/card')
    expect(loading).not.toContain('@/components/ui/card')
  })
})
