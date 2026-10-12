/**
 * Unit tests for the check that tells an event of an element from one of a
 * menu it renders.
 *
 * A card renders menus that are drawn in a portal, and React hands an event
 * in such a menu up to the card. These tests render a card with a menu item
 * in a portal and press both with React events.
 *
 * @see src/tests/unit/lib/utils/may-start-drag.test.tsx for the question of the drag sensors, which asks it
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { memo, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { describe, expect, test } from 'vitest'

import { startedOnOwnElement } from '@/lib/utils/started-on-own-element'

interface CardWithMenuProps {
  onMouseDown?: (event: MouseEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
}

/**
 * A card that listens for presses and keys, and an item of its menu drawn
 * elsewhere on the page.
 */
const CardWithMenu = memo(function CardWithMenu({
  onMouseDown,
  onKeyDown,
}: CardWithMenuProps) {
  return (
    <div onMouseDown={onMouseDown} onKeyDown={onKeyDown}>
      <h3>Title of the card</h3>
      {createPortal(
        <button type="button">Item of the menu</button>,
        document.body,
      )}
    </div>
  )
})

describe('startedOnOwnElement', () => {
  // Value: protects=a press on the card itself counts as the card's; fails_when=the check refuses every press, so nothing can be dragged; why_new=the check is new; seam=React events on a rendered element; no_claim=what the callers do with the answer
  test('counts a press on the title of the card as a press on the card', () => {
    // Arrange
    const answers: boolean[] = []
    render(
      <CardWithMenu
        onMouseDown={(event) => answers.push(startedOnOwnElement(event))}
      />,
    )

    // Act
    fireEvent.mouseDown(screen.getByText('Title of the card'))

    // Assert
    expect(answers).toEqual([true])
  })

  // Value: protects=a press in a menu of the card is told from a press on the card; fails_when=the check asks React's tree, where the menu is a child of the card, instead of the page; why_new=the check is new; seam=React events through a portal; no_claim=what the callers do with the answer
  test('does not count a press on an item of the menu, which is drawn elsewhere on the page', () => {
    // Arrange
    const answers: boolean[] = []
    render(
      <CardWithMenu
        onMouseDown={(event) => answers.push(startedOnOwnElement(event))}
      />,
    )

    // Act
    fireEvent.mouseDown(
      screen.getByRole('button', { name: 'Item of the menu' }),
    )

    // Assert
    expect(answers).toEqual([false])
  })

  // Value: protects=a key pressed in a menu of the card is told from a key pressed on the card; fails_when=the check works for presses only; why_new=the comment asks it for keys as well; seam=React events through a portal; no_claim=which keys the callers answer
  test('does not count a key pressed on an item of the menu', () => {
    // Arrange
    const answers: boolean[] = []
    render(
      <CardWithMenu
        onKeyDown={(event) => answers.push(startedOnOwnElement(event))}
      />,
    )

    // Act
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Item of the menu' }),
      {
        key: 'Enter',
      },
    )

    // Assert
    expect(answers).toEqual([false])
  })
})
