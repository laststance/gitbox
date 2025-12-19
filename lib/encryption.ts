/**
 * Encryption Module - AES-256-GCM Implementation
 *
 * Constitution Requirements:
 * - FR-011: Encrypted credentials are protected with AES-256-GCM
 * - FR-012: Masked display by default (e.g., `github_*****xyz789`)
 *
 * Implementation:
 * - Web Crypto API for AES-256-GCM encryption/decryption
 * - Random IV (Initialization Vector) for each encryption
 * - Base64 encoding for encrypted data
 */

/**
 * Generate a new AES-256-GCM encryption key
 *
 * @returns Promise<CryptoKey> - Generated encryption key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a value using AES-256-GCM
 *
 * @param value - Plain text value to encrypt
 * @param key - Encryption key (CryptoKey)
 * @returns Promise<string> - Base64-encoded encrypted data (IV + ciphertext)
 */
export async function encryptValue(
  value: string,
  key: CryptoKey,
): Promise<string> {
  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encode the plain text value
  const encoder = new TextEncoder()
  const data = encoder.encode(value)

  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data,
  )

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)

  // Convert to base64
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt an encrypted value using AES-256-GCM
 *
 * @param encryptedValue - Base64-encoded encrypted data (IV + ciphertext)
 * @param key - Decryption key (CryptoKey)
 * @returns Promise<string> - Decrypted plain text value
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function decryptValue(
  encryptedValue: string,
  key: CryptoKey,
): Promise<string> {
  try {
    // Decode base64
    const combined = Uint8Array.from(atob(encryptedValue), (c) =>
      c.charCodeAt(0),
    )

    // Extract IV (first 12 bytes)
    const iv = combined.slice(0, 12)

    // Extract encrypted data (remaining bytes)
    const encrypted = combined.slice(12)

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encrypted,
    )

    // Decode the plain text
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * Generate masked display for sensitive values
 *
 * Pattern: prefix_*****suffix
 * - Preserves prefix (e.g., "sk_live_", "ghp_", "pk_test_")
 * - Shows last 4-5 characters
 * - Masks the middle with "*****"
 *
 * Examples:
 * - "sk_live_51H4RdE2BqJhGwM5N8" → "sk_live_*****wM5N8"
 * - "ghp_1234567890abcdefABCDEF" → "ghp_*****CDEF"
 * - "short123" → "*****" (too short, show only asterisks)
 *
 * @param value - Sensitive value to mask
 * @returns string - Masked display string
 */
export function generateMaskedDisplay(value: string): string {
  if (!value) {
    return ''
  }

  // For very short values (< 8 chars), show only asterisks
  if (value.length < 8) {
    return '*****'
  }

  // Detect prefix pattern (e.g., "sk_live_", "ghp_", "pk_test_")
  // Matches: ghp_, sk_live_, pk_test_, rk_prod_, etc.
  const prefixMatch = value.match(/^([a-z]{2,3}_(?:[a-z]+_)?)/i)
  const prefix = prefixMatch ? prefixMatch[1] : ''

  // Determine suffix length based on prefix type
  // Special case: Stripe live keys (sk_live_) show 5 characters
  // All other keys show 4 characters
  let suffixLength = 4
  if (prefix === 'sk_live_') {
    suffixLength = 5
  }

  // Extract suffix (last N characters)
  const suffix = value.slice(-suffixLength)

  return `${prefix}*****${suffix}`
}

/**
 * Export encryption key to base64 string (for storage)
 *
 * @param key - CryptoKey to export
 * @returns Promise<string> - Base64-encoded key
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key)
  const exportedArray = new Uint8Array(exported)
  return btoa(String.fromCharCode(...exportedArray))
}

/**
 * Import encryption key from base64 string
 *
 * @param keyString - Base64-encoded key
 * @returns Promise<CryptoKey> - Imported encryption key
 */
export async function importKey(keyString: string): Promise<CryptoKey> {
  const keyArray = Uint8Array.from(atob(keyString), (c) => c.charCodeAt(0))

  return crypto.subtle.importKey(
    'raw',
    keyArray,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt'],
  )
}
