import { describe, expect, test } from 'vitest'

import { failedActionMessage } from '@/lib/utils/failed-action-message'

describe('failedActionMessage', () => {
  test('reads the sentence of a refused position write', () => {
    // Arrange & Act
    const message = failedActionMessage({
      success: false,
      error: 'A column cannot sit past row 999 or column 999.',
    })

    // Assert
    expect(message).toBe('A column cannot sit past row 999 or column 999.')
  })

  test('treats a test double that resolves to nothing as a success', () => {
    // Arrange & Act
    const message = failedActionMessage(undefined)

    // Assert
    expect(message).toBeNull()
  })

  test('treats a saved write as a success', () => {
    // Arrange & Act
    const message = failedActionMessage({ success: true, data: undefined })

    // Assert
    expect(message).toBeNull()
  })
})
