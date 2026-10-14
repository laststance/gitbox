/**
 * Unit tests for the drag sensors of the board.
 *
 * A card holds things that take presses and keys of their own: buttons, and
 * menus that are drawn in a portal while React hands their events up to the
 * card. These tests render a card with a button inside and a menu item in a
 * portal, press each with React events and ask the sensors whether a drag
 * starts.
 *
 * @see e2e/logged-in/what-starts-a-drag.spec.ts for the board in a browser
 * @see src/tests/unit/lib/utils/may-start-drag.test.tsx for the question the sensors ask
 */

import type { DraggableNode } from '@dnd-kit/core'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  memo,
  type KeyboardEvent,
  type MouseEvent,
  type TouchEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { describe, expect, test, vi } from 'vitest'

import {
  OwnElementKeyboardSensor,
  OwnElementMouseSensor,
  OwnElementTouchSensor,
} from '@/lib/utils/own-element-sensors'

interface CardWithMenuProps {
  onMouseDown?: (event: MouseEvent) => void
  onTouchStart?: (event: TouchEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
}

/**
 * A card with the listeners a draggable element has, a button inside it, and
 * an item of its menu drawn elsewhere on the page.
 */
const CardWithMenu = memo(function CardWithMenu({
  onMouseDown,
  onTouchStart,
  onKeyDown,
}: CardWithMenuProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Card"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onKeyDown={onKeyDown}
    >
      <h3>Title of the card</h3>
      <button type="button">Open note</button>
      {createPortal(
        <button type="button">Item of the menu</button>,
        document.body,
      )}
    </div>
  )
})

describe('OwnElementMouseSensor', () => {
  /**
   * The one activator of the mouse sensor.
   * @returns The activator that listens for the mouse press.
   */
  function mouseActivator() {
    const [activator] = OwnElementMouseSensor.activators
    if (!activator) throw new Error('the mouse sensor has no activator')
    return activator
  }

  // Value: protects=dnd-kit still hands the mouse press to this sensor; fails_when=the override loses the event name of the sensor it is made of; why_new=the sensor is new; seam=the static activators of the sensor; no_claim=what the handler answers, see the tests below
  test('listens for the mouse press, as the sensor it is made of', () => {
    // Arrange and act
    const eventNames = OwnElementMouseSensor.activators.map(
      (activator) => activator.eventName,
    )

    // Assert
    expect(eventNames).toEqual(['onMouseDown'])
  })

  // Value: protects=the mouse still drags a card; fails_when=the sensor refuses the presses of the card itself; why_new=the sensor is new; seam=the activator of the sensor with a React event; no_claim=the 8px of travel, which dnd-kit measures
  test('starts a drag from a press on the card', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: boolean[] = []
    render(
      <CardWithMenu
        onMouseDown={(event) =>
          answers.push(mouseActivator().handler(event, { onActivation }))
        }
      />,
    )

    // Act
    fireEvent.mouseDown(screen.getByText('Title of the card'))

    // Assert
    expect(answers).toEqual([true])
    expect(onActivation).toHaveBeenCalledTimes(1)
  })

  // Value: protects=a click on a menu item of a card, with a hand that moves, is no drag; fails_when=the sensor answers a press that React handed up from the menu; why_new=the sensor is new; seam=the activator of the sensor with a React event through a portal; no_claim=the browser, see what-starts-a-drag.spec.ts
  test('starts no drag from a press on an item of the menu', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: boolean[] = []
    render(
      <CardWithMenu
        onMouseDown={(event) =>
          answers.push(mouseActivator().handler(event, { onActivation }))
        }
      />,
    )

    // Act
    fireEvent.mouseDown(
      screen.getByRole('button', { name: 'Item of the menu' }),
    )

    // Assert
    expect(answers).toEqual([false])
    expect(onActivation).not.toHaveBeenCalled()
  })

  // Value: protects=a click on a button of a card, with a hand that moves, is no drag; fails_when=the mouse sensor starts without asking mayStartDrag; why_new=the sensor is new; seam=the activator of the sensor with a React event; no_claim=the browser, see what-starts-a-drag.spec.ts
  test('starts no drag from a press on a button of the card', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: boolean[] = []
    render(
      <CardWithMenu
        onMouseDown={(event) =>
          answers.push(mouseActivator().handler(event, { onActivation }))
        }
      />,
    )

    // Act
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Open note' }))

    // Assert
    expect(answers).toEqual([false])
    expect(onActivation).not.toHaveBeenCalled()
  })

  // Value: protects=the right mouse button opens the browser's menu and drags nothing; fails_when=the override answers itself and no longer asks the sensor it is made of; why_new=the sensor is new; seam=the activator of the sensor with a React event; no_claim=the browser's menu
  test('starts no drag from the right mouse button, as the sensor it is made of', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: boolean[] = []
    render(
      <CardWithMenu
        onMouseDown={(event) =>
          answers.push(mouseActivator().handler(event, { onActivation }))
        }
      />,
    )

    // Act
    fireEvent.mouseDown(screen.getByText('Title of the card'), { button: 2 })

    // Assert
    expect(answers).toEqual([false])
    expect(onActivation).not.toHaveBeenCalled()
  })
})

describe('OwnElementTouchSensor', () => {
  /**
   * The one activator of the touch sensor.
   * @returns The activator that listens for the finger.
   */
  function touchActivator() {
    const [activator] = OwnElementTouchSensor.activators
    if (!activator) throw new Error('the touch sensor has no activator')
    return activator
  }

  // Value: protects=dnd-kit still hands the finger to this sensor; fails_when=the override loses the event name of the sensor it is made of; why_new=the sensor is new; seam=the static activators of the sensor; no_claim=what the handler answers, see the tests below
  test('listens for the finger, as the sensor it is made of', () => {
    // Arrange and act
    const eventNames = OwnElementTouchSensor.activators.map(
      (activator) => activator.eventName,
    )

    // Assert
    expect(eventNames).toEqual(['onTouchStart'])
  })

  // Value: protects=a finger still drags a card; fails_when=the sensor refuses the fingers on the card itself; why_new=the sensor is new; seam=the activator of the sensor with a React event; no_claim=the 200ms of rest, which dnd-kit measures
  test('starts a drag from a finger on the card', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: boolean[] = []
    render(
      <CardWithMenu
        onTouchStart={(event) =>
          answers.push(touchActivator().handler(event, { onActivation }))
        }
      />,
    )

    // Act
    fireEvent.touchStart(screen.getByText('Title of the card'), {
      touches: [{ clientX: 10, clientY: 10 }],
    })

    // Assert
    expect(answers).toEqual([true])
    expect(onActivation).toHaveBeenCalledTimes(1)
  })

  // Value: protects=a slow tap on a menu item of a card is no drag; fails_when=the sensor answers a finger that React handed up from the menu; why_new=the sensor is new; seam=the activator of the sensor with a React event through a portal; no_claim=the browser, see what-starts-a-drag.spec.ts
  test('starts no drag from a finger on an item of the menu', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: boolean[] = []
    render(
      <CardWithMenu
        onTouchStart={(event) =>
          answers.push(touchActivator().handler(event, { onActivation }))
        }
      />,
    )

    // Act
    fireEvent.touchStart(
      screen.getByRole('button', { name: 'Item of the menu' }),
      { touches: [{ clientX: 10, clientY: 10 }] },
    )

    // Assert
    expect(answers).toEqual([false])
    expect(onActivation).not.toHaveBeenCalled()
  })

  // Value: protects=a slow tap on a button of a card is no drag; fails_when=the touch sensor starts without asking mayStartDrag; why_new=the sensor is new; seam=the activator of the sensor with a React event; no_claim=the browser, see what-starts-a-drag.spec.ts
  test('starts no drag from a finger on a button of the card', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: boolean[] = []
    render(
      <CardWithMenu
        onTouchStart={(event) =>
          answers.push(touchActivator().handler(event, { onActivation }))
        }
      />,
    )

    // Act
    fireEvent.touchStart(screen.getByRole('button', { name: 'Open note' }), {
      touches: [{ clientX: 10, clientY: 10 }],
    })

    // Assert
    expect(answers).toEqual([false])
    expect(onActivation).not.toHaveBeenCalled()
  })
})

describe('OwnElementKeyboardSensor', () => {
  /**
   * The one activator of the keyboard sensor.
   * @returns The activator that listens for the keys.
   */
  function keyboardActivator() {
    const [activator] = OwnElementKeyboardSensor.activators
    if (!activator) throw new Error('the keyboard sensor has no activator')
    return activator
  }

  /**
   * What dnd-kit knows of the dragged element when it asks the sensor. No
   * activator node is set, as on the board.
   */
  const draggedCard: DraggableNode = {
    id: 'card',
    key: 'card',
    node: { current: null },
    activatorNode: { current: null },
    data: { current: undefined },
  }

  // Value: protects=dnd-kit still hands the keys to this sensor; fails_when=the override loses the event name of the sensor it is made of; why_new=the sensor is new; seam=the static activators of the sensor; no_claim=what the handler answers, see the tests below
  test('listens for the keys, as the sensor it is made of', () => {
    // Arrange and act
    const eventNames = OwnElementKeyboardSensor.activators.map(
      (activator) => activator.eventName,
    )

    // Assert
    expect(eventNames).toEqual(['onKeyDown'])
  })

  // Value: protects=the keyboard still drags a card; fails_when=the sensor refuses the keys of the card itself; why_new=the sensor is new; seam=the activator of the sensor with a React event; no_claim=where the arrow keys move the card
  test('starts a drag from Space on the card', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: (boolean | undefined)[] = []
    render(
      <CardWithMenu
        onKeyDown={(event) =>
          answers.push(
            keyboardActivator().handler(
              event,
              { onActivation },
              { active: draggedCard },
            ),
          )
        }
      />,
    )

    // Act
    fireEvent.keyDown(screen.getByRole('button', { name: 'Card' }), {
      key: ' ',
      code: 'Space',
    })

    // Assert
    expect(answers).toEqual([true])
    expect(onActivation).toHaveBeenCalledTimes(1)
  })

  // Value: protects=the keyboard presses a button of a card; fails_when=the keyboard sensor starts without asking mayStartDrag, picks the card up and cancels the click; why_new=dnd-kit's sensor starts from a key on anything inside the card; seam=the activator of the sensor with a React event; no_claim=the browser, see what-starts-a-drag.spec.ts
  test('starts no drag from Enter on a button of the card, and leaves the key alone', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: (boolean | undefined)[] = []
    const defaultPrevented: boolean[] = []
    render(
      <CardWithMenu
        onKeyDown={(event) => {
          answers.push(
            keyboardActivator().handler(
              event,
              { onActivation },
              { active: draggedCard },
            ),
          )
          defaultPrevented.push(event.defaultPrevented)
        }}
      />,
    )

    // Act
    fireEvent.keyDown(screen.getByRole('button', { name: 'Open note' }), {
      key: 'Enter',
      code: 'Enter',
    })

    // Assert
    expect(answers).toEqual([false])
    expect(defaultPrevented).toEqual([false])
    expect(onActivation).not.toHaveBeenCalled()
  })

  // Value: protects=Space in a menu of a card is no drag; fails_when=the keyboard sensor answers a key that React handed up from the menu; why_new=only the default that Radix prevents kept dnd-kit's sensor from it; seam=the activator of the sensor with a React event through a portal; no_claim=a menu of Radix, which handles its keys itself
  test('starts no drag from Space on an item of the menu', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: (boolean | undefined)[] = []
    render(
      <CardWithMenu
        onKeyDown={(event) =>
          answers.push(
            keyboardActivator().handler(
              event,
              { onActivation },
              { active: draggedCard },
            ),
          )
        }
      />,
    )

    // Act
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Item of the menu' }),
      { key: ' ', code: 'Space' },
    )

    // Assert
    expect(answers).toEqual([false])
    expect(onActivation).not.toHaveBeenCalled()
  })

  // Value: protects=a letter typed on a card picks nothing up; fails_when=the override answers itself and no longer asks the sensor it is made of; why_new=the sensor is new; seam=the activator of the sensor with a React event; no_claim=the shortcuts of the card, which RepoCard answers
  test('starts no drag from a key other than Space and Enter, as the sensor it is made of', () => {
    // Arrange
    const onActivation = vi.fn()
    const answers: (boolean | undefined)[] = []
    render(
      <CardWithMenu
        onKeyDown={(event) =>
          answers.push(
            keyboardActivator().handler(
              event,
              { onActivation },
              { active: draggedCard },
            ),
          )
        }
      />,
    )

    // Act
    fireEvent.keyDown(screen.getByRole('button', { name: 'Card' }), {
      key: 'a',
      code: 'KeyA',
    })

    // Assert
    expect(answers).toEqual([false])
    expect(onActivation).not.toHaveBeenCalled()
  })
})
