/**
 * Unit tests: `next` is a same-origin path or the caller's fallback.
 *
 * The refresh route and the OAuth callback only reach this through those
 * handlers. A direct test is what fails when the null branch or an open
 * redirect starts being accepted.
 */

import { describe, expect, test } from 'vitest'

import { sanitizeNextPath } from '@/lib/utils/sanitize-next'

const FALLBACK = '/boards'

describe('sanitizeNextPath', () => {
  test('returns the fallback when next is missing', () => {
    // Arrange
    const rawNext = null

    // Act
    const path = sanitizeNextPath(rawNext, FALLBACK)

    // Assert
    expect(path).toBe('/boards')
  })

  test('keeps a same-origin path', () => {
    // Arrange
    const rawNext = '/board/abc'

    // Act
    const path = sanitizeNextPath(rawNext, FALLBACK)

    // Assert
    expect(path).toBe('/board/abc')
  })

  test('returns the fallback for a path that does not start at the site root', () => {
    // Arrange
    const rawNext = 'board/abc'

    // Act
    const path = sanitizeNextPath(rawNext, FALLBACK)

    // Assert
    expect(path).toBe('/boards')
  })

  test('returns the fallback for an absolute URL', () => {
    // Arrange
    const rawNext = 'https://evil.example/board/abc'

    // Act
    const path = sanitizeNextPath(rawNext, FALLBACK)

    // Assert
    expect(path).toBe('/boards')
  })

  test('returns the fallback for a javascript URL', () => {
    // Arrange
    const rawNext = 'javascript:alert(1)'

    // Act
    const path = sanitizeNextPath(rawNext, FALLBACK)

    // Assert
    expect(path).toBe('/boards')
  })

  test('returns the fallback for a protocol-relative URL', () => {
    // Arrange
    const rawNext = '//evil.example/board/abc'

    // Act
    const path = sanitizeNextPath(rawNext, FALLBACK)

    // Assert
    expect(path).toBe('/boards')
  })

  test('returns the fallback for a backslash path', () => {
    // Arrange: a browser treats this as a protocol-relative URL.
    const rawNext = '/\\evil.example'

    // Act
    const path = sanitizeNextPath(rawNext, FALLBACK)

    // Assert
    expect(path).toBe('/boards')
  })

  test('keeps a same-origin path that has a double slash later on', () => {
    // Arrange
    const rawNext = '/board//abc'

    // Act
    const path = sanitizeNextPath(rawNext, FALLBACK)

    // Assert
    expect(path).toBe('/board//abc')
  })

  test('returns the fallback the caller passed', () => {
    // Arrange
    const rawNext = 'https://evil.example'

    // Act
    const path = sanitizeNextPath(rawNext, '/account')

    // Assert
    expect(path).toBe('/account')
  })
})
