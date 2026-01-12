/**
 * User Link Presets CRUD Operations
 *
 * Server actions for managing user-defined link type presets.
 * These presets appear alongside built-in presets in the LinkTypeCombobox.
 */

'use server'

import * as Sentry from '@sentry/nextjs'

import { labelToValue } from '@/lib/constants/link-presets'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/lib/supabase/types'
import {
  presetValueSchema,
  presetLabelSchema,
  MAX_CUSTOM_PRESETS,
} from '@/lib/validations/user-presets'

type UserLinkPresetInsert = TablesInsert<'user_link_presets'>

/**
 * User preset data returned by getUserPresets
 */
export interface UserPreset {
  id: string
  value: string
  label: string
  icon: string
}

/**
 * Validate preset value format using Zod schema.
 *
 * @param value - The value to validate
 * @throws Error if value is invalid
 *
 * @example
 * validateValue('my-custom-preset') // => void (success)
 * validateValue('My Preset')        // => throws Error (not kebab-case)
 * validateValue('vercel')           // => throws Error (built-in)
 */
function validateValue(value: string): void {
  const result = presetValueSchema.safeParse(value)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || 'Invalid value')
  }
}

/**
 * Validate preset label using Zod schema.
 *
 * @param label - The label to validate
 * @throws Error if label is invalid
 *
 * @example
 * validateLabel('My Custom Service') // => void (success)
 * validateLabel('')                   // => throws Error (required)
 * validateLabel('x'.repeat(51))       // => throws Error (too long)
 */
function validateLabel(label: string): void {
  const result = presetLabelSchema.safeParse(label)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || 'Invalid label')
  }
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
export async function getUserPresets(): Promise<UserPreset[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

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
    id: row.id,
    value: row.value,
    label: row.label,
    icon: row.icon || 'Link',
  }))
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
  label: string,
  icon?: string,
): Promise<UserPreset> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  // Validate inputs
  validateLabel(label)
  const value = labelToValue(label)
  validateValue(value)

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
    id: data.id,
    value: data.value,
    label: data.label,
    icon: data.icon || 'Link',
  }
}
