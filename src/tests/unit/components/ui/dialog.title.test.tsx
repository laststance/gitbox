/**
 * Unit Test: the name a dialog gives itself
 *
 * Regression test for the design review of issue #213 (FINDING-008): every
 * dialog rendered a hidden title in front of its own one, both with the same
 * id, so "Add Status Column" and three more dialogs were announced as
 * "Dialog".
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

describe('Dialog title', () => {
  test('a dialog is announced by the title it shows, not as "Dialog"', () => {
    // Arrange & Act
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Status Column</DialogTitle>
            <DialogDescription>
              Create a new status column for your Kanban board.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    // Assert
    expect(
      screen.getByRole('dialog', { name: 'Add Status Column' }),
    ).toBeVisible()
  })

  test('a dialog with a visible title has that one heading and no duplicate id', () => {
    // Arrange & Act
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Another Board</DialogTitle>
            <DialogDescription>Pick a board and a column.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )

    // Assert
    const headings = screen.getAllByRole('heading')
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Move to Another Board')
    const titleId = screen.getByRole('dialog').getAttribute('aria-labelledby')
    expect(document.querySelectorAll(`[id="${titleId}"]`)).toHaveLength(1)
  })

  test('a dialog without a visible title takes its name from accessibleTitle', () => {
    // Arrange & Act
    render(
      <Dialog open>
        <DialogContent accessibleTitle="Search repositories">
          <DialogDescription>Type to filter.</DialogDescription>
        </DialogContent>
      </Dialog>,
    )

    // Assert
    expect(
      screen.getByRole('dialog', { name: 'Search repositories' }),
    ).toBeVisible()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
  })
})
