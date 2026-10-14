import { KeyboardSensor, MouseSensor, TouchSensor } from '@dnd-kit/core'

import { mayStartDrag } from '@/lib/utils/may-start-drag'

/**
 * Mouse sensor that picks an element up only from a press on the element itself.
 *
 * dnd-kit's {@link MouseSensor} with one more question before it starts,
 * {@link mayStartDrag}: a press in a menu the element renders, or on a button
 * inside it, is no drag however far the mouse slips. The board's sensors are
 * this one, {@link OwnElementTouchSensor} and {@link OwnElementKeyboardSensor}
 * ({@link useKanbanDnD}).
 *
 * @example
 * useSensor(OwnElementMouseSensor, { activationConstraint: { distance: 8 } })
 */
export class OwnElementMouseSensor extends MouseSensor {
  static activators = MouseSensor.activators.map((activator) => ({
    ...activator,
    handler: (...args: Parameters<typeof activator.handler>): boolean =>
      mayStartDrag(args[0]) && activator.handler(...args),
  }))
}

/**
 * Touch sensor that picks an element up only from a finger on the element itself.
 *
 * dnd-kit's {@link TouchSensor} with {@link mayStartDrag} asked first: a
 * finger that rests on a menu item or on a button for the sensor's delay is a
 * slow tap, not a drag.
 *
 * @example
 * useSensor(OwnElementTouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
 */
export class OwnElementTouchSensor extends TouchSensor {
  static activators = TouchSensor.activators.map((activator) => ({
    ...activator,
    handler: (...args: Parameters<typeof activator.handler>): boolean =>
      mayStartDrag(args[0]) && activator.handler(...args),
  }))
}

/**
 * Keyboard sensor that picks an element up only from a key pressed on the element itself.
 *
 * dnd-kit's {@link KeyboardSensor} with {@link mayStartDrag} asked first. On
 * its own that sensor starts from Space or Enter on anything inside the
 * element whose default nothing prevented: it compares the target with an
 * activator node, and nothing on the board sets one. Enter on the "Open note"
 * button of a card picked the card up and cancelled the click.
 *
 * @example
 * useSensor(OwnElementKeyboardSensor)
 */
export class OwnElementKeyboardSensor extends KeyboardSensor {
  static activators = KeyboardSensor.activators.map((activator) => ({
    ...activator,
    handler: (
      ...args: Parameters<typeof activator.handler>
    ): boolean | undefined =>
      mayStartDrag(args[0]) && activator.handler(...args),
  }))
}
