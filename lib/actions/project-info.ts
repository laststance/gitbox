/**
 * Project Info CRUD Operations
 *
 * Constitution requirements:
 * - Principle V: Security first (input validation, XSS prevention)
 *
 * User Story 4:
 * - Quick note: 1-3 line memo (300 character limit)
 * - Links: Production URL, Tracking services, Supabase Dashboard
 * - Supabase integration for persistent storage
 *
 * User Story 5:
 * - Credentials: 3 patterns of credential management
 *   - Pattern A: Reference (dashboard URL only)
 *   - Pattern B: Encrypted (AES-256-GCM encryption)
 *   - Pattern C: External (1Password/Bitwarden reference)
 */

'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type { TablesInsert, Tables, TablesUpdate } from '@/lib/supabase/types'

type ProjectInfoRow = Tables<'projectinfo'>
type ProjectInfoInsert = TablesInsert<'projectinfo'>
type ProjectInfoUpdate = TablesUpdate<'projectinfo'>
type CredentialRow = Tables<'credential'>
type CredentialInsert = TablesInsert<'credential'>

export interface ProjectLink {
  url: string
  type: 'production' | 'tracking' | 'supabase'
}

export interface Credential {
  id?: string
  type: 'reference' | 'encrypted' | 'external'
  name: string
  reference?: string
  encrypted_value?: string
  encryption_key_id?: string
  masked_display?: string
  location?: string
  note?: string
}

export interface ProjectInfoData {
  quickNote: string
  links: ProjectLink[]
  credentials?: Credential[]
}

/**
 * Validate quick note
 */
function validateQuickNote(note: string): boolean {
  if (note.length > 300) {
    throw new Error('Quick note must be 300 characters or less')
  }
  return true
}

/**
 * Validate URL
 */
function validateUrl(url: string): boolean {
  if (!url) return true // Allow empty URLs (will be filtered out)

  const urlRegex = /^https?:\/\/.+/
  if (!urlRegex.test(url)) {
    throw new Error('URL must start with http:// or https://')
  }

  try {
    new URL(url)
    return true
  } catch {
    throw new Error('Invalid URL format')
  }
}

/**
 * XSS prevention: HTML escape
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Validate credential
 */
function validateCredential(credential: Credential): boolean {
  // Name is required
  if (!credential.name || credential.name.trim().length === 0) {
    throw new Error('Credential name is required')
  }

  // Name length limit (100 characters)
  if (credential.name.length > 100) {
    throw new Error('Credential name must be 100 characters or less')
  }

  // Pattern A: Reference - reference field required
  if (credential.type === 'reference') {
    if (credential.reference) {
      validateUrl(credential.reference)
    }
  }

  // Pattern B: Encrypted - encrypted_value or masked_display required
  if (credential.type === 'encrypted') {
    if (!credential.encrypted_value && !credential.masked_display) {
      throw new Error(
        'Encrypted credential must have encrypted_value or masked_display',
      )
    }
  }

  // Pattern C: External - location field recommended (not required)
  // location can be any string

  // Note is optional, length limit (500 characters)
  if (credential.note && credential.note.length > 500) {
    throw new Error('Credential note must be 500 characters or less')
  }

  return true
}

/**
 * Get project info
 */
export async function getProjectInfo(
  repoCardId: string,
): Promise<ProjectInfoData | null> {
  const supabase = await createClient()

  const { data: projectInfo, error: infoError } = await supabase
    .from('projectinfo')
    .select('*')
    .eq('repo_card_id', repoCardId)
    .single<ProjectInfoRow>()

  if (infoError) {
    if (infoError.code === 'PGRST116') {
      // Return empty state if data doesn't exist
      return { quickNote: '', links: [], credentials: [] }
    }
    console.error('Failed to fetch project info:', infoError)
    throw new Error('Failed to fetch project information')
  }

  // Convert links from Json to array
  type LinksJson = {
    production?: string[]
    tracking?: string[]
    supabase?: string[]
  }
  const linksData = (projectInfo.links as LinksJson | null) || {
    production: [],
    tracking: [],
    supabase: [],
  }
  const linksArray: ProjectInfoData['links'] = [
    ...(linksData.production || []).map((url: string) => ({
      url,
      type: 'production' as const,
    })),
    ...(linksData.tracking || []).map((url: string) => ({
      url,
      type: 'tracking' as const,
    })),
    ...(linksData.supabase || []).map((url: string) => ({
      url,
      type: 'supabase' as const,
    })),
  ]

  // Get credentials
  const { data: credentials, error: credError } = await supabase
    .from('credential')
    .select('*')
    .eq('project_info_id', projectInfo.id)

  if (credError) {
    console.error('Failed to fetch credentials:', credError)
    // Credential fetch failure is not critical, return empty array
  }

  // Convert credentials to interface
  const credentialsArray: Credential[] = (credentials || []).map(
    (cred: CredentialRow) => ({
      id: cred.id,
      type: cred.type as 'reference' | 'encrypted' | 'external',
      name: cred.name,
      reference: cred.reference || undefined,
      encrypted_value: cred.encrypted_value || undefined,
      encryption_key_id: cred.encryption_key_id || undefined,
      masked_display: cred.masked_display || undefined,
      location: cred.location || undefined,
      note: cred.note || undefined,
    }),
  )

  return {
    quickNote: projectInfo.quick_note || '',
    links: linksArray,
    credentials: credentialsArray,
  }
}

/**
 * Create or update project info
 */
export async function upsertProjectInfo(
  repoCardId: string,
  data: ProjectInfoData,
): Promise<void> {
  const supabase = await createClient()

  // Validation
  validateQuickNote(data.quickNote)
  data.links.forEach((link) => {
    if (link.url) {
      validateUrl(link.url)
    }
  })

  // Credentials validation
  if (data.credentials) {
    data.credentials.forEach((credential) => {
      validateCredential(credential)
    })
  }

  // XSS escape
  const escapedNote = escapeHtml(data.quickNote)

  // Convert links to match type
  const linksJson = {
    production: data.links
      .filter((l) => l.type === 'production')
      .map((l) => l.url),
    tracking: data.links.filter((l) => l.type === 'tracking').map((l) => l.url),
    supabase: data.links.filter((l) => l.type === 'supabase').map((l) => l.url),
  }

  try {
    // project_info upsert
    const { data: existingInfo } = await supabase
      .from('projectinfo')
      .select('id')
      .eq('repo_card_id', repoCardId)
      .single<{ id: string }>()

    let projectInfoId: string

    if (existingInfo) {
      // Update
      projectInfoId = existingInfo.id
      const updateData: ProjectInfoUpdate = {
        quick_note: escapedNote,
        links: linksJson,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('projectinfo')
        .update(updateData)
        .eq('id', existingInfo.id)

      if (updateError) {
        console.error('Failed to update project info:', updateError)
        throw new Error('Failed to update project information')
      }
    } else {
      // Create new
      const insertData: ProjectInfoInsert = {
        repo_card_id: repoCardId,
        quick_note: escapedNote,
        links: linksJson,
      }

      const { data: newProjectInfo, error: createError } = await supabase
        .from('projectinfo')
        .insert(insertData)
        .select('id')
        .single<{ id: string }>()

      if (createError || !newProjectInfo) {
        console.error('Failed to create project info:', createError)
        throw new Error('Failed to create project information')
      }

      projectInfoId = newProjectInfo.id
    }

    // Process credentials
    if (data.credentials) {
      // Get existing credentials
      const { data: existingCredentials } = await supabase
        .from('credential')
        .select('id')
        .eq('project_info_id', projectInfoId)

      const existingCredentialIds = new Set(
        (existingCredentials || []).map((c) => c.id),
      )
      const submittedCredentialIds = new Set(
        data.credentials.filter((c) => c.id).map((c) => c.id!),
      )

      // Delete: Remove credentials that were not submitted
      const credentialsToDelete = Array.from(existingCredentialIds).filter(
        (id) => !submittedCredentialIds.has(id),
      )

      if (credentialsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('credential')
          .delete()
          .in('id', credentialsToDelete)

        if (deleteError) {
          console.error('Failed to delete credentials:', deleteError)
        }
      }

      // Update and create
      for (const credential of data.credentials) {
        const credentialData = {
          project_info_id: projectInfoId,
          type: credential.type,
          name: escapeHtml(credential.name),
          reference: credential.reference
            ? escapeHtml(credential.reference)
            : null,
          encrypted_value: credential.encrypted_value || null,
          encryption_key_id: credential.encryption_key_id || null,
          masked_display: credential.masked_display || null,
          location: credential.location
            ? escapeHtml(credential.location)
            : null,
          note: credential.note ? escapeHtml(credential.note) : null,
        }

        if (credential.id && existingCredentialIds.has(credential.id)) {
          // Update
          const { error: updateCredError } = await supabase
            .from('credential')
            .update(credentialData)
            .eq('id', credential.id)

          if (updateCredError) {
            console.error('Failed to update credential:', updateCredError)
            throw new Error(`Failed to update credential: ${credential.name}`)
          }
        } else {
          // Create new
          const { error: insertCredError } = await supabase
            .from('credential')
            .insert(credentialData as CredentialInsert)

          if (insertCredError) {
            console.error('Failed to insert credential:', insertCredError)
            throw new Error(`Failed to create credential: ${credential.name}`)
          }
        }
      }
    }

    // Invalidate cache
    revalidatePath('/board')
    revalidatePath(`/board/${repoCardId}`)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('An error occurred while saving project information')
  }
}

/**
 * Delete project info
 */
export async function deleteProjectInfo(repoCardId: string): Promise<void> {
  const supabase = await createClient()

  const { data: projectInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('repo_card_id', repoCardId)
    .single<{ id: string }>()

  if (!projectInfo) {
    return // Do nothing if data doesn't exist
  }

  const { error } = await supabase
    .from('projectinfo')
    .delete()
    .eq('id', projectInfo.id)

  if (error) {
    console.error('Failed to delete project info:', error)
    throw new Error('Failed to delete project information')
  }

  // Invalidate cache
  revalidatePath('/board')
  revalidatePath(`/board/${repoCardId}`)
}
