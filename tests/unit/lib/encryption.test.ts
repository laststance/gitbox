/**
 * Unit Test: Encryption/Decryption Module
 *
 * Constitution要件:
 * - Principle VI: TDD - テストファースト
 * - FR-011: 暗号化された認証情報はAES-256-GCMで保護
 * - FR-012: デフォルトでマスク表示（例: `github_*****xyz789`）
 *
 * テスト対象:
 * - AES-256-GCM encryption/decryption
 * - Masked display generation
 * - Error handling for invalid keys/data
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import from implementation (will be created after tests)
import {
  encryptValue,
  decryptValue,
  generateMaskedDisplay,
  generateEncryptionKey,
} from '@/lib/encryption';

describe('Encryption Module', () => {
  let testKey: CryptoKey;
  const testValue = 'sk_live_51H4RdE2BqJhGwM5N8';

  beforeEach(async () => {
    // Generate a test encryption key before each test
    testKey = await generateEncryptionKey();
  });

  describe('AES-256-GCM Encryption', () => {
    it('should encrypt a value successfully', async () => {
      const encrypted = await encryptValue(testValue, testKey);

      // Encrypted value should be a base64 string
      expect(encrypted).toBeTypeOf('string');
      expect(encrypted.length).toBeGreaterThan(0);

      // Encrypted value should be different from original
      expect(encrypted).not.toBe(testValue);
    });

    it('should produce different encrypted values for the same input with different keys', async () => {
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();

      const encrypted1 = await encryptValue(testValue, key1);
      const encrypted2 = await encryptValue(testValue, key2);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce different encrypted values for the same input with same key (IV randomization)', async () => {
      const encrypted1 = await encryptValue(testValue, testKey);
      const encrypted2 = await encryptValue(testValue, testKey);

      // Due to random IV, encrypted values should be different even with same key
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('AES-256-GCM Decryption', () => {
    it('should decrypt an encrypted value successfully', async () => {
      const encrypted = await encryptValue(testValue, testKey);
      const decrypted = await decryptValue(encrypted, testKey);

      expect(decrypted).toBe(testValue);
    });

    it('should handle multiple encrypt-decrypt cycles', async () => {
      const value1 = 'ghp_abc123xyz789';
      const value2 = 'sk_test_12345';

      const encrypted1 = await encryptValue(value1, testKey);
      const encrypted2 = await encryptValue(value2, testKey);

      const decrypted1 = await decryptValue(encrypted1, testKey);
      const decrypted2 = await decryptValue(encrypted2, testKey);

      expect(decrypted1).toBe(value1);
      expect(decrypted2).toBe(value2);
    });

    it('should fail to decrypt with wrong key', async () => {
      const encrypted = await encryptValue(testValue, testKey);
      const wrongKey = await generateEncryptionKey();

      await expect(decryptValue(encrypted, wrongKey)).rejects.toThrow();
    });

    it('should fail to decrypt invalid encrypted data', async () => {
      const invalidData = 'invalid-base64-data';

      await expect(decryptValue(invalidData, testKey)).rejects.toThrow();
    });

    it('should fail to decrypt with tampered data', async () => {
      const encrypted = await encryptValue(testValue, testKey);

      // Tamper with the encrypted data
      const tampered = encrypted.slice(0, -5) + 'XXXXX';

      await expect(decryptValue(tampered, testKey)).rejects.toThrow();
    });
  });

  describe('Masked Display Generation', () => {
    it('should generate masked display for GitHub tokens', () => {
      const token = 'ghp_1234567890abcdefABCDEF';
      const masked = generateMaskedDisplay(token);

      expect(masked).toBe('ghp_*****CDEF');
      expect(masked).toContain('ghp_');
      expect(masked).toContain('*****');
      expect(masked).toContain('CDEF'); // Last 4 characters
    });

    it('should generate masked display for Stripe API keys', () => {
      const apiKey = 'sk_live_51H4RdE2BqJhGwM5N8';
      const masked = generateMaskedDisplay(apiKey);

      expect(masked).toBe('sk_live_*****wM5N8');
      expect(masked).toContain('sk_live_');
      expect(masked).toContain('*****');
      expect(masked).toContain('wM5N8'); // Last 5 characters
    });

    it('should generate masked display for Supabase keys', () => {
      const supabaseKey =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiYzEyMyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQzMjQwMDAwfQ.1234567890';
      const masked = generateMaskedDisplay(supabaseKey);

      // Should show prefix + ***** + last 4
      expect(masked).toContain('*****');
      expect(masked.length).toBeLessThan(supabaseKey.length);
    });

    it('should handle short values (< 8 characters)', () => {
      const shortValue = '1234567';
      const masked = generateMaskedDisplay(shortValue);

      // For short values, show only asterisks
      expect(masked).toBe('*****');
    });

    it('should handle empty strings', () => {
      const masked = generateMaskedDisplay('');

      expect(masked).toBe('');
    });

    it('should preserve prefix patterns (prefix_*****suffix)', () => {
      const values = [
        { input: 'sk_test_1234567890', expected: 'sk_test_*****7890' },
        { input: 'pk_live_abcdefghij', expected: 'pk_live_*****ghij' },
        { input: 'rk_prod_ABCDEFGHIJ', expected: 'rk_prod_*****GHIJ' },
      ];

      values.forEach(({ input, expected }) => {
        const masked = generateMaskedDisplay(input);
        expect(masked).toBe(expected);
      });
    });
  });

  describe('Key Generation', () => {
    it('should generate a valid AES-256-GCM key', async () => {
      const key = await generateEncryptionKey();

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
      expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
    });

    it('should generate different keys on each call', async () => {
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();

      // Export keys to compare
      const exported1 = await crypto.subtle.exportKey('raw', key1);
      const exported2 = await crypto.subtle.exportKey('raw', key2);

      const array1 = new Uint8Array(exported1);
      const array2 = new Uint8Array(exported2);

      // Keys should be different
      expect(array1).not.toEqual(array2);
    });

    it('should generate keys suitable for encryption/decryption', async () => {
      const key = await generateEncryptionKey();

      // Test that the key can be used for encryption/decryption
      const testData = 'Test encryption with generated key';
      const encrypted = await encryptValue(testData, key);
      const decrypted = await decryptValue(encrypted, key);

      expect(decrypted).toBe(testData);
    });
  });

  describe('Security Properties', () => {
    it('should use different IVs for each encryption (non-deterministic)', async () => {
      const iterations = 10;
      const encryptedValues = new Set<string>();

      for (let i = 0; i < iterations; i++) {
        const encrypted = await encryptValue('same-value', testKey);
        encryptedValues.add(encrypted);
      }

      // All encrypted values should be unique due to random IVs
      expect(encryptedValues.size).toBe(iterations);
    });

    it('should handle unicode characters correctly', async () => {
      const unicodeValue = '日本語のパスワード🔐';
      const encrypted = await encryptValue(unicodeValue, testKey);
      const decrypted = await decryptValue(encrypted, testKey);

      expect(decrypted).toBe(unicodeValue);
    });

    it('should handle long values (>1KB)', async () => {
      const longValue = 'A'.repeat(2000);
      const encrypted = await encryptValue(longValue, testKey);
      const decrypted = await decryptValue(encrypted, testKey);

      expect(decrypted).toBe(longValue);
      expect(decrypted.length).toBe(2000);
    });

    it('should handle special characters and symbols', async () => {
      const specialValue = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = await encryptValue(specialValue, testKey);
      const decrypted = await decryptValue(encrypted, testKey);

      expect(decrypted).toBe(specialValue);
    });
  });
});
