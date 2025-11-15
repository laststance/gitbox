/**
 * Database Schema & RLS Policies Integration Test
 *
 * 目的: Supabase データベーススキーマと Row Level Security (RLS) ポリシーの動作を検証
 *
 * テスト範囲:
 * 1. テーブル存在確認 (Board, StatusList, RepoCard, ProjectInfo, Credential, Maintenance, AuditLog)
 * 2. RLS ポリシーの動作確認（ユーザー分離、認証なしアクセス拒否）
 * 3. Cascade Delete の動作確認
 * 4. Triggers の動作確認 (updated_at 自動更新、デフォルトボード作成)
 * 5. Unique Constraints の動作確認
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// テスト用 Supabase クライアント（サービスロール）
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// テスト用ユーザー
let testUser1: { id: string; email: string }
let testUser2: { id: string; email: string }

describe('Database Schema & RLS Integration Tests', () => {
  beforeAll(async () => {
    // テスト用ユーザーを作成（Supabase Admin API）
    const user1Response = await supabaseAdmin.auth.admin.createUser({
      email: 'test-user-1@example.com',
      password: 'test-password-123',
      email_confirm: true,
    })
    if (user1Response.error) throw user1Response.error
    testUser1 = {
      id: user1Response.data.user.id,
      email: user1Response.data.user.email!,
    }

    const user2Response = await supabaseAdmin.auth.admin.createUser({
      email: 'test-user-2@example.com',
      password: 'test-password-456',
      email_confirm: true,
    })
    if (user2Response.error) throw user2Response.error
    testUser2 = {
      id: user2Response.data.user.id,
      email: user2Response.data.user.email!,
    }
  })

  afterAll(async () => {
    // テスト用ユーザーを削除
    if (testUser1) {
      await supabaseAdmin.auth.admin.deleteUser(testUser1.id)
    }
    if (testUser2) {
      await supabaseAdmin.auth.admin.deleteUser(testUser2.id)
    }
  })

  describe('1. Table Existence', () => {
    it('Board テーブルが存在する', async () => {
      const { data, error } = await supabaseAdmin
        .from('Board')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })
  })
})
