/**
 * isServer Utility Tests
 *
 * Tests for SSR detection utility.
 * Note: In browser mode, window is always defined, so SSR simulation tests
 * verify the function's behavior with the actual browser environment.
 */

import { describe, it, expect, beforeEach } from 'vitest'

import {
  isServer,
  isBrowser,
  isStorageAvailable,
  isSessionStorageAvailable,
} from '../../src/utils/isServer'

describe('isServer', () => {
  it('returns false in browser environment', () => {
    // In Vitest browser mode, we're running in a real browser
    // so window is always defined
    expect(isServer()).toBe(false)
  })

  it('correctly detects browser environment', () => {
    // Verify window exists in browser mode
    expect(typeof window).toBe('object')
    expect(isServer()).toBe(false)
  })
})

describe('isBrowser', () => {
  it('returns true in browser environment', () => {
    expect(isBrowser()).toBe(true)
  })

  it('correctly detects browser with window object', () => {
    expect(typeof window).toBe('object')
    expect(isBrowser()).toBe(true)
  })
})

describe('isStorageAvailable', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns true when localStorage is available', () => {
    expect(isStorageAvailable()).toBe(true)
  })

  it('verifies localStorage operations work', () => {
    // In real browser, localStorage should work
    localStorage.setItem('test-key', 'test-value')
    expect(localStorage.getItem('test-key')).toBe('test-value')
    localStorage.removeItem('test-key')

    expect(isStorageAvailable()).toBe(true)
  })
})

describe('isSessionStorageAvailable', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('returns true when sessionStorage is available', () => {
    expect(isSessionStorageAvailable()).toBe(true)
  })

  it('verifies sessionStorage operations work', () => {
    // In real browser, sessionStorage should work
    sessionStorage.setItem('test-key', 'test-value')
    expect(sessionStorage.getItem('test-key')).toBe('test-value')
    sessionStorage.removeItem('test-key')

    expect(isSessionStorageAvailable()).toBe(true)
  })
})

describe('SSR Detection Logic', () => {
  it('isServer and isBrowser are mutually exclusive', () => {
    // These should always be opposite values
    expect(isServer()).not.toBe(isBrowser())
  })

  it('in browser mode, isBrowser is true and isServer is false', () => {
    expect(isBrowser()).toBe(true)
    expect(isServer()).toBe(false)
  })
})
