/**
 * Unit Tests: get-claims-display-info
 *
 * Verifies the board layout's header info extraction from Supabase JWT claims:
 *  - Picks `user_metadata.full_name` when present
 *  - Falls back to `email`, then to literal `'User'`
 *  - Returns `avatar_url` only when it is a string, else `undefined`
 *
 * Each test hard-codes the expected value (DAMP), follows AAA layout, and is
 * named after the observable behavior the layout depends on.
 */

import { describe, it, expect } from 'vitest'

import type { SupabaseClaims } from '@/lib/auth/get-cached-claims'
import { getClaimsDisplayInfo } from '@/lib/utils/get-claims-display-info'

/**
 * Minimal valid claims fixture. Tests override only the fields under test so
 * any future field added to `SupabaseClaims` won't force a rewrite here.
 */
const baseClaims = {
  iss: 'supabase-demo',
  sub: '00000000-0000-0000-0000-000000000001',
  aud: 'authenticated',
  exp: 9999999999,
  iat: 1700000000,
  role: 'authenticated',
} satisfies SupabaseClaims

describe('getClaimsDisplayInfo', () => {
  it('uses user_metadata.full_name as the header name when available', () => {
    // Arrange
    const claims: SupabaseClaims = {
      ...baseClaims,
      email: 'alice@example.com',
      user_metadata: {
        full_name: 'Alice Liddell',
        avatar_url: 'https://cdn.example.com/alice.png',
      },
    }

    // Act
    const result = getClaimsDisplayInfo(claims)

    // Assert
    expect(result).toEqual({
      userName: 'Alice Liddell',
      userAvatar: 'https://cdn.example.com/alice.png',
    })
  })

  it('falls back to email when full_name is missing from user_metadata', () => {
    // Arrange
    const claims: SupabaseClaims = {
      ...baseClaims,
      email: 'bob@example.com',
      user_metadata: { avatar_url: 'https://cdn.example.com/bob.png' },
    }

    // Act
    const result = getClaimsDisplayInfo(claims)

    // Assert
    expect(result).toEqual({
      userName: 'bob@example.com',
      userAvatar: 'https://cdn.example.com/bob.png',
    })
  })

  it("falls back to literal 'User' when both full_name and email are missing", () => {
    // Arrange
    const claims: SupabaseClaims = {
      ...baseClaims,
      user_metadata: {},
    }

    // Act
    const result = getClaimsDisplayInfo(claims)

    // Assert
    expect(result).toEqual({
      userName: 'User',
      userAvatar: undefined,
    })
  })

  it('returns avatar undefined when user_metadata is missing entirely', () => {
    // Arrange
    const claims: SupabaseClaims = {
      ...baseClaims,
      email: 'carol@example.com',
    }

    // Act
    const result = getClaimsDisplayInfo(claims)

    // Assert
    expect(result).toEqual({
      userName: 'carol@example.com',
      userAvatar: undefined,
    })
  })

  it('rejects non-string full_name and falls back to email', () => {
    // Arrange
    const claims: SupabaseClaims = {
      ...baseClaims,
      email: 'dan@example.com',
      // GitHub OAuth can omit/replace metadata fields. Defend against
      // unexpected shapes coming back from the JWT.
      user_metadata: { full_name: 12345, avatar_url: 'https://cdn/d.png' },
    }

    // Act
    const result = getClaimsDisplayInfo(claims)

    // Assert
    expect(result).toEqual({
      userName: 'dan@example.com',
      userAvatar: 'https://cdn/d.png',
    })
  })

  it('rejects non-string avatar_url and returns undefined', () => {
    // Arrange
    const claims: SupabaseClaims = {
      ...baseClaims,
      email: 'eve@example.com',
      user_metadata: { full_name: 'Eve', avatar_url: { url: 'no' } },
    }

    // Act
    const result = getClaimsDisplayInfo(claims)

    // Assert
    expect(result).toEqual({
      userName: 'Eve',
      userAvatar: undefined,
    })
  })

  it('returns email when full_name is an empty string', () => {
    // Arrange
    // An empty `full_name` should not render as a blank header; the layout
    // depends on the `||` cascade falling through to `email`.
    const claims: SupabaseClaims = {
      ...baseClaims,
      email: 'fran@example.com',
      user_metadata: { full_name: '' },
    }

    // Act
    const result = getClaimsDisplayInfo(claims)

    // Assert
    expect(result).toEqual({
      userName: 'fran@example.com',
      userAvatar: undefined,
    })
  })
})
