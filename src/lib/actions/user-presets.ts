/**
 * User Link Presets CRUD Operations
 *
 * Server actions for managing user-defined link type presets.
 * These presets appear alongside built-in presets in the LinkTypeCombobox.
 */

'use server'

import * as Sentry from '@sentry/nextjs'

import {
  withAuthResult,
  withAuthResultRateLimit,
} from '@/lib/actions/auth-guard'
import { labelToValue } from '@/lib/constants/link-presets'
import type { TablesInsert } from '@/lib/supabase/types'
import { toUserLinkPresetId, type UserLinkPresetId } from '@/lib/types/brands'
import type {
  LinkPresetLabel,
  LinkPresetValue,
  LucideIconName,
} from '@/lib/types/domain-primitives'
import {
  presetValueSchema,
  presetLabelSchema,
  MAX_CUSTOM_PRESETS,
} from '@/lib/validations/user-presets'

import type { ActionResult } from './types'

type UserLinkPresetInsert = TablesInsert<'user_link_presets'>

/**
 * User preset data returned by getUserPresets
 */
export interface UserPreset {
  id: UserLinkPresetId
  value: LinkPresetValue
  label: LinkPresetLabel
  icon: LucideIconName
}

/**
 * Get all custom presets for the current user
 *
 * @returns Array of user presets sorted by label
 *
 * @example
 * const presets = await getUserPresets()
 * // Returns: [{ id: '...', value: 'my-service', label: 'My Service', icon: 'Link' }, ...]
 */
export async function getUserPresets(): Promise<ActionResult<UserPreset[]>> {
  return withAuthResult(async (supabase, user) => {
    const { data, error } = await supabase
      .from('user_link_presets')
      .select('id, value, label, icon')
      .eq('user_id', user.id)
      .order('label', { ascending: true })

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Get user presets', userId: user.id },
      })
      throw new Error('Failed to fetch custom presets')
    }

    return (data || []).map((row) => ({
      id: toUserLinkPresetId(row.id),
      value: row.value,
      label: row.label,
      icon: row.icon || 'Link',
    }))
  })
}

/**
 * Create a new custom preset for the current user
 *
 * @param label - Display name for the preset
 * @param icon - Optional lucide icon name (defaults to 'Link')
 * @returns The created preset
 * @throws Error if validation fails or user has reached preset limit
 *
 * @example
 * const preset = await createUserPreset('My Custom Service', 'Star')
 * // Returns: { id: '...', value: 'my-custom-service', label: 'My Custom Service', icon: 'Star' }
 */
export async function createUserPreset(
  label: LinkPresetLabel,
  icon?: LucideIconName,
): Promise<ActionResult<UserPreset>> {
  // Validate inputs before auth (fast fail)
  const labelResult = presetLabelSchema.safeParse(label)
  if (!labelResult.success) {
    return {
      success: false,
      error: labelResult.error.issues[0]?.message || 'Invalid label',
    }
  }
  const value = labelToValue(label)
  const valueResult = presetValueSchema.safeParse(value)
  if (!valueResult.success) {
    return {
      success: false,
      error: valueResult.error.issues[0]?.message || 'Invalid value',
    }
  }

  return withAuthResultRateLimit('userSettings', async (supabase, user) => {
    // Check preset limit
    const { count, error: countError } = await supabase
      .from('user_link_presets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError) {
      Sentry.captureException(countError, {
        extra: { context: 'Count user presets', userId: user.id },
      })
      throw new Error('Failed to check preset limit')
    }

    if ((count || 0) >= MAX_CUSTOM_PRESETS) {
      throw new Error(
        `Maximum of ${MAX_CUSTOM_PRESETS} custom presets reached. Delete some to add more.`,
      )
    }

    // Check for duplicate value
    const { data: existing } = await supabase
      .from('user_link_presets')
      .select('id')
      .eq('user_id', user.id)
      .eq('value', value)
      .single()

    if (existing) {
      throw new Error('A preset with this name already exists')
    }

    // Create preset
    const insertData: UserLinkPresetInsert = {
      user_id: user.id,
      value,
      label: label.trim(),
      icon: icon || 'Link',
    }

    const { data, error } = await supabase
      .from('user_link_presets')
      .insert(insertData)
      .select('id, value, label, icon')
      .single()

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Create user preset', userId: user.id, label },
      })
      throw new Error('Failed to create custom preset')
    }

    return {
      id: toUserLinkPresetId(data.id),
      value: data.value,
      label: data.label,
      icon: data.icon || 'Link',
    }
  })
}
