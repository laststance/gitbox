/**
 * Audit Log Actions
 *
 * PRD 3.4: Record all sensitive information access in audit logs
 * - Credentials viewing
 * - Credentials copying
 * - Credentials creation/update/deletion
 */

'use server'

import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'
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
 * Record audit log event
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
 * Log credential view event
 */
export async function logCredentialView(credentialId: string): Promise<void> {
  await logAuditEvent({
    action: 'credential_view',
    resourceId: credentialId,
    resourceType: 'credential',
  })
}

/**
 * Log credential copy event
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
 * Log credential reveal event
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
 * Log credential creation event
 */
export async function logCredentialCreate(credentialId: string): Promise<void> {
  await logAuditEvent({
    action: 'credential_create',
    resourceId: credentialId,
    resourceType: 'credential',
  })
}

/**
 * Log credential update event
 */
export async function logCredentialUpdate(credentialId: string): Promise<void> {
  await logAuditEvent({
    action: 'credential_update',
    resourceId: credentialId,
    resourceType: 'credential',
  })
}

/**
 * Log credential deletion event
 */
export async function logCredentialDelete(credentialId: string): Promise<void> {
  await logAuditEvent({
    action: 'credential_delete',
    resourceId: credentialId,
    resourceType: 'credential',
  })
}

/**
 * Log board creation event
 */
export async function logBoardCreate(boardId: string): Promise<void> {
  await logAuditEvent({
    action: 'board_create',
    resourceId: boardId,
    resourceType: 'board',
  })
}

/**
 * Get recent audit logs
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
