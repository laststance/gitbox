/**
 * Database Schema & RLS Policies Integration Test
 *
 * Purpose: Verify Supabase database schema and Row Level Security (RLS) policy behavior
 *
 * Test scope:
 * 1. Table existence verification (Board, StatusList, RepoCard, ProjectInfo, Credential, Maintenance, AuditLog)
 * 2. RLS policy behavior verification (user isolation, unauthorized access denial)
 * 3. Cascade Delete behavior verification
 * 4. Triggers behavior verification (updated_at auto-update, default board creation)
 * 5. Unique Constraints behavior verification
 */

import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import type { Database } from '@/lib/supabase/types'

// Test Supabase client (service role)
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

// Test users
let testUser1: { id: string; email: string }
let testUser2: { id: string; email: string }

describe('Database Schema & RLS Integration Tests', () => {
  beforeAll(async () => {
    // Create test users (Supabase Admin API)
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
    // Delete test users
    if (testUser1) {
      await supabaseAdmin.auth.admin.deleteUser(testUser1.id)
    }
    if (testUser2) {
      await supabaseAdmin.auth.admin.deleteUser(testUser2.id)
    }
  })

  describe('1. Table Existence', () => {
    it('Board table exists', async () => {
      const { data, error } = await supabaseAdmin
        .from('board')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })
  })
})
