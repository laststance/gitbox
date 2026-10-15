/**
 * Unit Tests: which code-exchange failures are a multi-tab PKCE collision
 *
 * The slower tab must be signed in again. A reused code must still be
 * shown as a failed sign-in.
 *
 * @see src/lib/utils/is-pkce-verifier-mismatch.ts
 */

import { describe, expect, test } from 'vitest'

import { isPkceVerifierMismatch } from '@/lib/utils/is-pkce-verifier-mismatch'

describe('a failed code exchange', () => {
  test('is a collision when the verifier belongs to the other tab', () => {
    // Arrange / Act / Assert
    expect(
      isPkceVerifierMismatch(
        'code challenge does not match previously saved code verifier',
      ),
    ).toBe(true)
  })

  test('is a collision when the verifier cookie is gone', () => {
    // Arrange / Act / Assert
    expect(
      isPkceVerifierMismatch(
        'invalid request: both auth code and code verifier should be non-empty',
      ),
    ).toBe(true)
  })

  test('is a collision when the stored flow state was replaced', () => {
    // Arrange / Act / Assert
    expect(
      isPkceVerifierMismatch('invalid flow state, no valid flow state found'),
    ).toBe(true)
  })

  test('is a failed sign-in when the code itself was refused', () => {
    // Arrange / Act / Assert
    expect(isPkceVerifierMismatch('invalid grant')).toBe(false)
  })
})
