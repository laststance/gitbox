/**
 * Unit Tests: getForwardedClientIp
 *
 * `x-real-ip` is the address to key. A forwarded list uses its last hop so a
 * prefix cannot choose the bucket. One address is unchanged.
 */

import { describe, expect, test } from 'vitest'

import { getClientIp } from '@/lib/rate-limit/edge-memory'
import { getForwardedClientIp } from '@/lib/utils/get-client-ip'

describe('getForwardedClientIp', () => {
  test('returns the only forwarded hop', () => {
    // Arrange
    const headers = new Headers({ 'x-forwarded-for': ' 203.0.113.10 ' })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBe('203.0.113.10')
  })

  test('uses the last hop when x-forwarded-for is a list', () => {
    // Arrange
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.1, 203.0.113.50',
    })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBe('203.0.113.50')
  })

  test('uses x-real-ip when x-forwarded-for is a list', () => {
    // Arrange
    const headers = new Headers({
      'x-real-ip': '203.0.113.8',
      'x-forwarded-for': '198.51.100.1, 203.0.113.8',
    })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBe('203.0.113.8')
  })

  test('uses the last hop of a three-address chain', () => {
    // Arrange
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.1, 198.51.100.2, 192.0.2.3',
    })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBe('192.0.2.3')
  })

  test('trims whitespace around the last hop', () => {
    // Arrange
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.1,  203.0.113.50  ',
    })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBe('203.0.113.50')
  })

  test('trims whitespace around x-real-ip', () => {
    // Arrange
    const headers = new Headers({ 'x-real-ip': '  203.0.113.8  ' })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBe('203.0.113.8')
  })

  test('uses the last forwarded hop when x-real-ip is blank', () => {
    // Arrange
    const headers = new Headers({
      'x-real-ip': '   ',
      'x-forwarded-for': '198.51.100.1, 203.0.113.50',
    })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBe('203.0.113.50')
  })

  test('returns null when the address headers are missing', () => {
    // Arrange
    const headers = new Headers()

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBeNull()
  })

  test('returns null when x-forwarded-for is empty', () => {
    // Arrange
    const headers = new Headers({ 'x-forwarded-for': '' })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBeNull()
  })

  test('returns the last hop when it is not an address', () => {
    // Arrange
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.1, not-an-ip',
    })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBe('not-an-ip')
  })

  test('returns null when neither header has an address', () => {
    // Arrange
    const headers = new Headers({
      'x-real-ip': '   ',
      'x-forwarded-for': ' , ',
    })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBeNull()
  })
})

describe('getClientIp', () => {
  test('keys a forwarded list by its last hop', () => {
    // Arrange
    const request = new Request('http://localhost/auth/callback', {
      headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.50' },
    })

    // Act
    const ip = getClientIp(request)

    // Assert
    expect(ip).toBe('203.0.113.50')
  })

  test('falls back to loopback when no address header is present', () => {
    // Arrange
    const request = new Request('http://localhost/auth/callback')

    // Act
    const ip = getClientIp(request)

    // Assert
    expect(ip).toBe('127.0.0.1')
  })
})
