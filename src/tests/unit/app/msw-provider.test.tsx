/**
 * Unit test: the mock-worker provider renders the page at once.
 *
 * The server HTML has to be the page. A placeholder until the worker starts
 * is what the browser hydrates, and a hydration error in the page never
 * appears.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { MSWProvider } from '@/app/msw-provider'

describe('MSWProvider', () => {
  test('renders the page while the worker is still starting', () => {
    // Arrange / Act
    render(
      <MSWProvider>
        <p>Board</p>
      </MSWProvider>,
    )

    // Assert
    expect(screen.getByText('Board')).toBeVisible()
    expect(screen.queryByText('Initializing MSW...')).toBeNull()
  })
})
