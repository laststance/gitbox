/**
 * Unit Tests: events
 *
 * Tests for custom event utilities for cross-component communication:
 * - OPEN_SHORTCUTS_HELP constant
 * - openShortcutsHelp function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { OPEN_SHORTCUTS_HELP, openShortcutsHelp } from '@/lib/events'

describe('events', () => {
  describe('OPEN_SHORTCUTS_HELP constant', () => {
    it('should have the correct event name', () => {
      expect(OPEN_SHORTCUTS_HELP).toBe('gitbox:open-shortcuts-help')
    })

    it('should be a string literal type', () => {
      // TypeScript type checking - this compiles means it's the literal type
      const eventName: 'gitbox:open-shortcuts-help' = OPEN_SHORTCUTS_HELP
      expect(eventName).toBe('gitbox:open-shortcuts-help')
    })
  })

  describe('openShortcutsHelp', () => {
    let dispatchEventSpy: ReturnType<typeof vi.spyOn>
    let eventReceived: CustomEvent | null = null

    beforeEach(() => {
      eventReceived = null
      dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
      window.addEventListener(OPEN_SHORTCUTS_HELP, ((e: CustomEvent) => {
        eventReceived = e
      }) as EventListener)
    })

    afterEach(() => {
      dispatchEventSpy.mockRestore()
      window.removeEventListener(OPEN_SHORTCUTS_HELP, () => {})
    })

    it('should dispatch a CustomEvent', () => {
      openShortcutsHelp()

      expect(dispatchEventSpy).toHaveBeenCalledTimes(1)
      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent))
    })

    it('should dispatch event with correct event name', () => {
      openShortcutsHelp()

      const dispatchedEvent = dispatchEventSpy.mock.calls[0][0] as CustomEvent
      expect(dispatchedEvent.type).toBe(OPEN_SHORTCUTS_HELP)
    })

    it('should trigger event listeners', () => {
      openShortcutsHelp()

      expect(eventReceived).not.toBeNull()
      expect(eventReceived?.type).toBe(OPEN_SHORTCUTS_HELP)
    })

    it('should return void', () => {
      const result = openShortcutsHelp()

      expect(result).toBeUndefined()
    })

    it('should be callable multiple times', () => {
      openShortcutsHelp()
      openShortcutsHelp()
      openShortcutsHelp()

      expect(dispatchEventSpy).toHaveBeenCalledTimes(3)
    })
  })
})
