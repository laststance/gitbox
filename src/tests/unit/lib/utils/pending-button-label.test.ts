/**
 * Unit Tests: pending button labels
 *
 * Forms used to choose the idle and pending strings inline. A missed call
 * is a missed ellipsis or a Title Case command that flips while a request
 * runs.
 *
 * @see src/lib/utils/pending-button-label.ts
 */

import { describe, expect, test } from 'vitest'

import { pendingButtonLabel } from '@/lib/utils/pending-button-label'

describe('pendingButtonLabel', () => {
  test('keeps the idle command while the request is not running', () => {
    // Arrange
    const isPending = false

    // Act
    const label = pendingButtonLabel(isPending, 'Create Board', 'Creating…')

    // Assert
    expect(label).toBe('Create Board')
  })

  test('uses the pending ellipsis form while the request runs', () => {
    // Arrange
    const isPending = true

    // Act
    const label = pendingButtonLabel(isPending, 'Create Board', 'Creating…')

    // Assert
    expect(label).toBe('Creating…')
  })
})
