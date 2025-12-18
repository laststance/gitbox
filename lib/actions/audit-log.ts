/**
 * Audit Log Actions
 *
 * PRD 3.4: すべての機密情報アクセスを監査ログに記録
 * - Credentials閲覧
 * - Credentials コピー
 * - Credentials 追加/編集/削除
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import type { AuditLog } from '@/lib/supabase/types'

export type AuditAction =
  | 'credential_view'
  | 'credential_copy'
  | 'credential_create'
  | 'credential_update'
  | 'credential_delete'
  | 'credential_reveal'
  | 'project_info_view'
  | 'project_info_update'
  | 'board_create'
  | 'board_update'
  | 'board_delete'
  | 'login'
  | 'logout'

export type ResourceType =
  | 'credential'
  | 'project_info'
  | 'board'
  | 'repo_card'
  | 'status_list'
  | 'user'

interface AuditLogParams {
  action: AuditAction
  resourceId?: string
  resourceType?: ResourceType
  metadata?: Record<string, unknown>
  success?: boolean
}

/**
 * 監査ログを記録する
 */
export async function logAuditEvent({
  action,
  resourceId,
  resourceType,
  metadata: _metadata,
  success = true,
}: AuditLogParams): Promise<void> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.warn(
        '[AuditLog] Attempted to log event without authenticated user',
      )
      return
    }

    // Get request headers
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || 'unknown'
    const forwardedFor = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown'

    // Insert audit log
    const { error } = await supabase.from('auditlog').insert({
      user_id: user.id,
      action,
      resource_id: resourceId || 'unknown',
      resource_type: resourceType || 'unknown',
      ip_address: ipAddress,
      user_agent: userAgent,
      success,
    })

    if (error) {
      console.error('[AuditLog] Failed to insert audit log:', error)
    }
  } catch (err) {
    // Don't throw - audit logging should never break the main flow
    console.error('[AuditLog] Error logging audit event:', err)
  }
}

/**
 * 認証情報の閲覧をログに記録
 */
export async function logCredentialView(credentialId: string): Promise<void> {
  await logAuditEvent({
    action: 'credential_view',
    resourceId: credentialId,
    resourceType: 'credential',
  })
}

/**
 * 認証情報のコピーをログに記録
 */
export async function logCredentialCopy(credentialId: string): Promise<void> {
  await logAuditEvent({
    action: 'credential_copy',
    resourceId: credentialId,
    resourceType: 'credential',
    metadata: { copied_at: new Date().toISOString() },
  })
}

/**
 * 認証情報の表示（reveal）をログに記録
 */
export async function logCredentialReveal(credentialId: string): Promise<void> {
  await logAuditEvent({
    action: 'credential_reveal',
    resourceId: credentialId,
    resourceType: 'credential',
    metadata: { revealed_at: new Date().toISOString() },
  })
}

/**
 * 認証情報の作成をログに記録
 */
export async function logCredentialCreate(credentialId: string): Promise<void> {
  await logAuditEvent({
    action: 'credential_create',
    resourceId: credentialId,
    resourceType: 'credential',
  })
}

/**
 * 認証情報の更新をログに記録
 */
export async function logCredentialUpdate(credentialId: string): Promise<void> {
  await logAuditEvent({
    action: 'credential_update',
    resourceId: credentialId,
    resourceType: 'credential',
  })
}

/**
 * 認証情報の削除をログに記録
 */
export async function logCredentialDelete(credentialId: string): Promise<void> {
  await logAuditEvent({
    action: 'credential_delete',
    resourceId: credentialId,
    resourceType: 'credential',
  })
}

/**
 * ボード作成をログに記録
 */
export async function logBoardCreate(boardId: string): Promise<void> {
  await logAuditEvent({
    action: 'board_create',
    resourceId: boardId,
    resourceType: 'board',
  })
}

/**
 * 最近の監査ログを取得
 */
export async function getRecentAuditLogs(limit = 50): Promise<{
  logs: AuditLog[]
  error: string | null
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { logs: [], error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('auditlog')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[AuditLog] Failed to fetch audit logs:', error)
      return { logs: [], error: error.message }
    }

    return { logs: data || [], error: null }
  } catch (err) {
    console.error('[AuditLog] Error fetching audit logs:', err)
    return { logs: [], error: 'Failed to fetch audit logs' }
  }
}
