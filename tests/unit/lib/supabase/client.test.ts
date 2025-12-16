/**
 * Supabase Client Tests
 *
 * T028.1: Unit test for Supabase client initialization
 * - 環境変数の検証
 * - クライアントインスタンスの作成
 * - 認証設定の確認
 */

import { describe, it, expect } from 'vitest'

describe('Supabase Client (lib/supabase/client.ts)', () => {
  describe('Environment Variables', () => {
    it('should have NEXT_PUBLIC_SUPABASE_URL defined', () => {
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined()
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co')
    })

    it('should have NEXT_PUBLIC_SUPABASE_ANON_KEY defined', () => {
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined()
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-anon-key')
    })
  })

  describe('Client Module', () => {
    it('should export supabase client', async () => {
      const { supabase } = await import('@/lib/supabase/client')

      expect(supabase).toBeDefined()
      expect(supabase.auth).toBeDefined()
    })

    it('should export getSession function', async () => {
      const { getSession } = await import('@/lib/supabase/client')

      expect(typeof getSession).toBe('function')
    })

    it('should export getUser function', async () => {
      const { getUser } = await import('@/lib/supabase/client')

      expect(typeof getUser).toBe('function')
    })

    it('should export signInWithGitHub function', async () => {
      const { signInWithGitHub } = await import('@/lib/supabase/client')

      expect(typeof signInWithGitHub).toBe('function')
    })

    it('should export signOut function', async () => {
      const { signOut } = await import('@/lib/supabase/client')

      expect(typeof signOut).toBe('function')
    })

    it('should export onAuthStateChange function', async () => {
      const { onAuthStateChange } = await import('@/lib/supabase/client')

      expect(typeof onAuthStateChange).toBe('function')
    })
  })

  describe('Client Configuration', () => {
    it('should have auth configuration', async () => {
      const { supabase } = await import('@/lib/supabase/client')

      // Verify supabase client has auth methods
      expect(supabase.auth.getSession).toBeDefined()
      expect(supabase.auth.getUser).toBeDefined()
      expect(supabase.auth.signInWithOAuth).toBeDefined()
      expect(supabase.auth.signOut).toBeDefined()
      expect(supabase.auth.onAuthStateChange).toBeDefined()
    })
  })
})
