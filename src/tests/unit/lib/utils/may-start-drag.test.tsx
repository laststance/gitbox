/**
 * Unit tests for the question the drag sensors of the board ask before they
 * start: may this press or key pick up the element that listens for it?
 *
 * These tests render what a card is made of or may come to hold (a title, a
 * comment, a button, fields, a link, the marked box of an editor and an item
 * of a menu drawn in a portal), press each with React events and ask the
 * question from the listening element.
 *
 * @see src/tests/unit/lib/utils/own-element-sensors.test.tsx for the sensors that ask it
 * @see e2e/logged-in/what-starts-a-drag.spec.ts for the board in a browser
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { memo, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { describe, expect, test } from 'vitest'

import { mayStartDrag } from '@/lib/utils/may-start-drag'

interface CardProps {
  onMouseDown?: (event: MouseEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
}

/**
 * A card with the listeners of a draggable element: a title, a comment that
 * is a `div` with the role of a button, a button with an icon, a field, a
 * link, an input, a select and editable text, the box of an editor that
 * carries `data-no-drag` around its counter, and an item of its menu drawn
 * elsewhere on the page.
 */
const Card = memo(function Card({ onMouseDown, onKeyDown }: CardProps) {
  return (
    <div onMouseDown={onMouseDown} onKeyDown={onKeyDown}>
      <h3>Title of the card</h3>
      <div role="button" tabIndex={0}>
        Comment of the card
      </div>
      <button type="button" aria-label="Open note">
        <span>Note</span>
      </button>
      <textarea aria-label="Field of the card" />
      <a href="https://example.com/repository">Link of the card</a>
      <input aria-label="Input of the card" />
      <select aria-label="Select of the card">
        <option>First choice</option>
      </select>
      <div contentEditable suppressContentEditableWarning>
        Editable text of the card
      </div>
      <div data-no-drag>
        <span>Counter of the editor</span>
      </div>
      {createPortal(
        <button type="button">Item of the menu</button>,
        document.body,
      )}
    </div>
  )
})

/**
 * A handle that is a button and has the drag listeners itself, as the handle
 * of a board in the boards list is.
 */
const Handle = memo(function Handle({ onMouseDown }: CardProps) {
  return (
    <button type="button" aria-label="Drag handle" onMouseDown={onMouseDown}>
      <span>Grip</span>
    </button>
  )
})

/** A card that listens for the drag and lies inside a link. */
const CardInsideLink = memo(function CardInsideLink({
  onMouseDown,
}: CardProps) {
  return (
    <a href="https://example.com/repository">
      <div onMouseDown={onMouseDown}>
        <h3>Title of the linked card</h3>
      </div>
    </a>
  )
})

describe('mayStartDrag', () => {
  // Value: protects=a card is picked up by a press on its title; fails_when=the question refuses every press, so nothing can be dragged; why_new=the question is new; seam=React events on a rendered element; no_claim=the 8px and the 200ms, which dnd-kit measures
  test('lets a press on the title of the card pick the card up', () => {
    // Arrange
    const answers: boolean[] = []
    render(<Card onMouseDown={(event) => answers.push(mayStartDrag(event))} />)

    // Act
    fireEvent.mouseDown(screen.getByText('Title of the card'))

    // Assert
    expect(answers).toEqual([true])
  })

  // Value: protects=a card can be picked up at its comment, which is most of its surface; fails_when=the list of controls grows to everything with the role of a button; why_new=the question is new; seam=React events on a rendered element; no_claim=that a click on the comment opens its editor
  test('lets a press on the comment pick the card up, although the comment has the role of a button', () => {
    // Arrange
    const answers: boolean[] = []
    render(<Card onMouseDown={(event) => answers.push(mayStartDrag(event))} />)

    // Act
    fireEvent.mouseDown(screen.getByText('Comment of the card'))

    // Assert
    expect(answers).toEqual([true])
  })

  // Value: protects=a click on a button of a card, with a hand that moves, is no drag; fails_when=the question counts everything inside the card as the card; why_new=the question is new; seam=React events on a rendered element; no_claim=the browser, see what-starts-a-drag.spec.ts
  test('does not let a press on a button of the card pick the card up', () => {
    // Arrange
    const answers: boolean[] = []
    render(<Card onMouseDown={(event) => answers.push(mayStartDrag(event))} />)

    // Act
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Open note' }))

    // Assert
    expect(answers).toEqual([false])
  })

  // Value: protects=a press on the icon or the label of a button counts as a press on the button; fails_when=the question looks at the pressed element alone and not at what it lies in; why_new=the question is new; seam=React events on a rendered element; no_claim=the browser, see what-starts-a-drag.spec.ts
  test('does not let a press on the label inside a button pick the card up', () => {
    // Arrange
    const answers: boolean[] = []
    render(<Card onMouseDown={(event) => answers.push(mayStartDrag(event))} />)

    // Act
    fireEvent.mouseDown(screen.getByText('Note'))

    // Assert
    expect(answers).toEqual([false])
  })

  // Value: protects=text in a field of a card can be marked with the mouse; fails_when=the list of controls loses its fields; why_new=the question is new; seam=React events on a rendered element; no_claim=the box around the field of the comment editor, which the next test covers
  test('does not let a press in a field of the card pick the card up', () => {
    // Arrange
    const answers: boolean[] = []
    render(<Card onMouseDown={(event) => answers.push(mayStartDrag(event))} />)

    // Act
    fireEvent.mouseDown(
      screen.getByRole('textbox', { name: 'Field of the card' }),
    )

    // Assert
    expect(answers).toEqual([false])
  })

  // Value: protects=a link, an input, a select and editable text inside a draggable element take their own presses; fails_when=one of them drops out of the list of controls; why_new=the list is new, and only its button and its textarea were pinned; seam=React events on a rendered element; no_claim=that a card of the board holds any of them today
  test.each([
    {
      control: 'a link',
      find: () => screen.getByRole('link', { name: 'Link of the card' }),
    },
    {
      control: 'an input',
      find: () => screen.getByRole('textbox', { name: 'Input of the card' }),
    },
    {
      control: 'a select',
      find: () => screen.getByRole('combobox', { name: 'Select of the card' }),
    },
    {
      control: 'editable text',
      find: () => screen.getByText('Editable text of the card'),
    },
  ])(
    'does not let a press on $control of the card pick the card up',
    ({ find }) => {
      // Arrange
      const answers: boolean[] = []
      render(
        <Card onMouseDown={(event) => answers.push(mayStartDrag(event))} />,
      )

      // Act
      fireEvent.mouseDown(find())

      // Assert
      expect(answers).toEqual([false])
    },
  )

  // Value: protects=a press on the counter or the padding of the comment editor is no drag; fails_when=the question forgets the data-no-drag mark, and the counter is neither a field nor a button; why_new=the editor stopped pointerdown, which no sensor of the board listens for; seam=React events on a rendered element; no_claim=the browser, see what-starts-a-drag.spec.ts
  test('does not let a press inside a box that carries data-no-drag pick the card up', () => {
    // Arrange
    const answers: boolean[] = []
    render(<Card onMouseDown={(event) => answers.push(mayStartDrag(event))} />)

    // Act
    fireEvent.mouseDown(screen.getByText('Counter of the editor'))

    // Assert
    expect(answers).toEqual([false])
  })

  // Value: protects=Enter on a button of a card presses the button; fails_when=the question works for presses only; why_new=the keyboard sensor asks it as well; seam=React events on a rendered element; no_claim=which keys start a drag, which dnd-kit decides
  test('does not let a key pressed on a button of the card pick the card up', () => {
    // Arrange
    const answers: boolean[] = []
    render(<Card onKeyDown={(event) => answers.push(mayStartDrag(event))} />)

    // Act
    fireEvent.keyDown(screen.getByRole('button', { name: 'Open note' }), {
      key: 'Enter',
      code: 'Enter',
    })

    // Assert
    expect(answers).toEqual([false])
  })

  // Value: protects=a press in a menu of the card is no drag; fails_when=the question forgets to ask where on the page the press started; why_new=the question is new; seam=React events through a portal; no_claim=the browser, see what-starts-a-drag.spec.ts
  test('does not let a press on an item of the menu pick the card up', () => {
    // Arrange
    const answers: boolean[] = []
    render(<Card onMouseDown={(event) => answers.push(mayStartDrag(event))} />)

    // Act
    fireEvent.mouseDown(
      screen.getByRole('button', { name: 'Item of the menu' }),
    )

    // Assert
    expect(answers).toEqual([false])
  })

  // Value: protects=a handle that is a button still drags; fails_when=the question refuses a button although the button is what listens; why_new=the question is new; seam=React events on a rendered element; no_claim=the boards list, which keeps dnd-kit's own sensors
  test('lets a press on a handle that is a button itself pick it up', () => {
    // Arrange
    const answers: boolean[] = []
    render(
      <Handle onMouseDown={(event) => answers.push(mayStartDrag(event))} />,
    )

    // Act
    fireEvent.mouseDown(screen.getByText('Grip'))

    // Assert
    expect(answers).toEqual([true])
  })

  // Value: protects=a draggable element inside a link or a button can still be picked up; fails_when=the question takes a control around the element for one inside it; why_new=the question is new; seam=React events on a rendered element; no_claim=that the board nests a card in a link, which it does not
  test('lets a press on a card that lies inside a link pick the card up', () => {
    // Arrange
    const answers: boolean[] = []
    render(
      <CardInsideLink
        onMouseDown={(event) => answers.push(mayStartDrag(event))}
      />,
    )

    // Act
    fireEvent.mouseDown(screen.getByText('Title of the linked card'))

    // Assert
    expect(answers).toEqual([true])
  })
})
