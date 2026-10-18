/**
 * Unit Tests: the loading state of the account page
 *
 * The skeleton stands in for the page while its data loads, so its Account
 * Data summary has the same two cells in the same grid as the loaded page:
 * Boards and Repository Cards. The page does not jump when the data arrives.
 *
 * @see src/app/account/loading.tsx
 */

import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import AccountLoading from '@/app/account/loading'

describe('account page loading state', () => {
  test('shows two skeleton cells in the two-column grid of the Account Data summary', () => {
    // Arrange / Act
    const { container } = render(<AccountLoading />)

    // Assert
    const tileGrid = container.querySelector('.grid-cols-2')
    expect(tileGrid).not.toBeNull()
    expect(tileGrid?.children).toHaveLength(2)
  })
})
