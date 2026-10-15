/**
 * Unit Tests: getForwardedClientIp
 *
 * The first hop of `x-forwarded-for` is caller-controlled on Vercel, because
 * the edge appends the connecting address. These tests lock the trusted
 * address: `x-real-ip`, otherwise the last hop.
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

  test('ignores a spoofed first hop and uses the address the edge appended', () => {
    // Arrange
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.1, 203.0.113.50',
    })

    // Act
    const ip = getForwardedClientIp(headers)

    // Assert
    expect(ip).toBe('203.0.113.50')
  })

  test('uses x-real-ip when the forwarded chain starts with a spoofed address', () => {
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
  test('rate-limits a spoofed forwarded chain as the edge address', () => {
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
