/**
 * Unit Tests: FormError
 *
 * Inline refused-write copy. An empty message must not leave an empty alert
 * on the page. A shown message must be an alert in the destructive color.
 *
 * @see src/components/ui/form-error.tsx
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { FormError } from '@/components/ui/form-error'

describe('FormError', () => {
  test('renders nothing when the message is empty', () => {
    // Arrange
    const { container } = render(<FormError message="" />)

    // Act
    const alert = screen.queryByRole('alert')

    // Assert
    expect(alert).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  test('renders nothing when the message is missing', () => {
    // Arrange
    const { container } = render(<FormError />)

    // Act
    const alert = screen.queryByRole('alert')

    // Assert
    expect(alert).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  test('shows the sentence as a destructive alert', () => {
    // Arrange
    render(<FormError message="The board was not created. Try again." />)

    // Act
    const alert = screen.getByRole('alert')

    // Assert
    expect(alert).toBeVisible()
    expect(alert).toHaveTextContent('The board was not created. Try again.')
    expect(alert).toHaveClass('text-destructive')
  })
})
