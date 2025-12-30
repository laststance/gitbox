/**
 * Theme Constants - Single Source of Truth
 *
 * All theme metadata (colors, names, descriptions) centralized here.
 * Import this instead of defining themes locally in components.
 *
 * @see CLAUDE.md for the 14-theme system documentation
 */

// ========================================
// Theme ID Arrays (for iteration/validation)
// ========================================

export const LIGHT_THEME_IDS = [
  'default',
  'sunrise',
  'sandstone',
  'mint',
  'sky',
  'lavender',
  'rose',
] as const

export const DARK_THEME_IDS = [
  'dark',
  'midnight',
  'graphite',
  'forest',
  'ocean',
  'plum',
  'rust',
] as const

export const ALL_THEME_IDS = [...LIGHT_THEME_IDS, ...DARK_THEME_IDS] as const

// ========================================
// Type Definitions
// ========================================

export type LightThemeId = (typeof LIGHT_THEME_IDS)[number]
export type DarkThemeId = (typeof DARK_THEME_IDS)[number]
export type ThemeId = (typeof ALL_THEME_IDS)[number]

/** Theme type including 'system' option for user preference */
export type ThemeType = ThemeId | 'system'

/** Metadata for each theme (display name, color, description) */
export interface ThemeMetadata {
  name: string
  color: string
  description: string
  /** True if theme needs a border (for light backgrounds like 'default') */
  needsBorder?: boolean
}

// ========================================
// Theme Metadata (colors, names, descriptions)
// ========================================

export const THEME_METADATA: Record<ThemeId, ThemeMetadata> = {
  // Light themes
  default: {
    name: 'Default',
    color: '#fafafa',
    description: 'Clean neutral',
    needsBorder: true,
  },
  sunrise: {
    name: 'Sunrise',
    color: '#f59e0b',
    description: 'Warm amber tones',
  },
  sandstone: {
    name: 'Sandstone',
    color: '#a8a29e',
    description: 'Earthy neutral',
  },
  mint: { name: 'Mint', color: '#10b981', description: 'Fresh green' },
  sky: { name: 'Sky', color: '#0ea5e9', description: 'Calm blue' },
  lavender: { name: 'Lavender', color: '#a78bfa', description: 'Soft purple' },
  rose: { name: 'Rose', color: '#f43f5e', description: 'Vibrant pink' },
  // Dark themes
  dark: { name: 'Dark', color: '#18181b', description: 'Clean dark' },
  midnight: { name: 'Midnight', color: '#1e40af', description: 'Deep blue' },
  graphite: { name: 'Graphite', color: '#374151', description: 'Dark gray' },
  forest: { name: 'Forest', color: '#166534', description: 'Dark green' },
  ocean: { name: 'Ocean', color: '#0c4a6e', description: 'Deep teal' },
  plum: { name: 'Plum', color: '#7e22ce', description: 'Rich purple' },
  rust: { name: 'Rust', color: '#9a3412', description: 'Dark orange' },
}

/** Extended metadata including 'system' option (for Settings page) */
export const THEME_INFO: Record<ThemeType, ThemeMetadata> = {
  ...THEME_METADATA,
  system: {
    name: 'System',
    color: '#6b7280',
    description: 'Follow system preference',
  },
}

// ========================================
// Helper Functions
// ========================================

/**
 * Check if a theme is a dark theme.
 * @param theme - The theme to check
 * @returns True if the theme is a dark theme
 * @example
 * isDarkTheme('midnight') // => true
 * isDarkTheme('sunrise')  // => false
 * isDarkTheme('system')   // => false
 */
export function isDarkTheme(theme: ThemeType): boolean {
  return DARK_THEME_IDS.includes(theme as DarkThemeId)
}

/**
 * Check if a theme ID is valid (for validation).
 * @param theme - The theme string to validate
 * @returns True if valid theme ID (excludes 'system')
 * @example
 * isValidThemeId('midnight') // => true
 * isValidThemeId('system')   // => false (system is user pref only)
 * isValidThemeId('invalid')  // => false
 */
export function isValidThemeId(theme: string): theme is ThemeId {
  return ALL_THEME_IDS.includes(theme as ThemeId)
}

// ========================================
// Legacy Exports (for compatibility with existing code)
// ========================================

/** @deprecated Use LIGHT_THEME_IDS instead */
export const LIGHT_THEMES: ThemeType[] = [...LIGHT_THEME_IDS]

/** @deprecated Use DARK_THEME_IDS instead */
export const DARK_THEMES: ThemeType[] = [...DARK_THEME_IDS]

/** @deprecated Use ALL_THEME_IDS instead (note: this includes 'system') */
export const ALL_THEMES: ThemeType[] = [...ALL_THEME_IDS, 'system']

/** Valid theme IDs for Zod validation schemas */
export const VALID_THEME_IDS = ALL_THEME_IDS
