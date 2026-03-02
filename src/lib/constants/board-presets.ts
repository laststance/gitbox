/**
 * Board Preset Definitions
 *
 * Status List preset patterns for board creation.
 * Shared between client (CreateBoardForm) and server (board.ts actions).
 *
 * @example
 * import { BOARD_PRESETS, DEFAULT_PRESET_ID, getPresetById } from '@/lib/constants/board-presets'
 *
 * // Get the default preset
 * const preset = BOARD_PRESETS[DEFAULT_PRESET_ID]
 * // => { id: 'web-app', label: 'Web App', columns: [...] }
 *
 * // Get a preset by ID with fallback
 * const preset = getPresetById('cli-tool')
 * // => { id: 'cli-tool', label: 'CLI Tool', columns: [...] }
 */

/** Single column definition within a preset */
export interface PresetColumn {
  /** Column display name */
  name: string
  /** Column header color (hex) */
  color: string
}

/** Board preset definition */
export interface BoardPreset {
  /** Unique identifier (kebab-case) */
  id: string
  /** Display name shown on the radio card */
  label: string
  /** Short description for context */
  description: string
  /** Columns this preset creates */
  columns: readonly PresetColumn[]
}

export const PRESET_IDS = [
  'software-release',
  'web-app',
  'electron-desktop',
  'cli-tool',
  'mobile',
  'macos',
] as const

export type PresetId = (typeof PRESET_IDS)[number]

export const DEFAULT_PRESET_ID: PresetId = 'web-app'

export const BOARD_PRESETS: Record<PresetId, BoardPreset> = {
  'software-release': {
    id: 'software-release',
    label: 'Software Release',
    description: 'Track repos through release lifecycle',
    columns: [
      { name: 'Pending', color: '#8B7355' },
      { name: 'Planning', color: '#6B8E23' },
      { name: 'Focus Development', color: '#CD853F' },
      { name: 'MVP Release', color: '#4682B4' },
      { name: 'Production Release', color: '#556B2F' },
    ],
  },
  'web-app': {
    id: 'web-app',
    label: 'Web App',
    description: 'Categorize web application repos',
    columns: [
      { name: 'Frontend', color: '#3B82F6' },
      { name: 'Backend', color: '#10B981' },
      { name: 'Fullstack', color: '#8B5CF6' },
      { name: 'Library', color: '#F59E0B' },
      { name: 'Infrastructure', color: '#6366F1' },
    ],
  },
  'electron-desktop': {
    id: 'electron-desktop',
    label: 'Electron Desktop',
    description: 'Organize Electron ecosystem repos',
    columns: [
      { name: 'Main App', color: '#2563EB' },
      { name: 'Plugin', color: '#7C3AED' },
      { name: 'Theme', color: '#EC4899' },
      { name: 'Utility', color: '#14B8A6' },
      { name: 'Build Tool', color: '#F97316' },
    ],
  },
  'cli-tool': {
    id: 'cli-tool',
    label: 'CLI Tool',
    description: 'Manage command-line tool repos',
    columns: [
      { name: 'Command', color: '#059669' },
      { name: 'Framework', color: '#4F46E5' },
      { name: 'Generator', color: '#D97706' },
      { name: 'Linter', color: '#DC2626' },
      { name: 'Config', color: '#6B7280' },
    ],
  },
  mobile: {
    id: 'mobile',
    label: 'Mobile',
    description: 'iOS, Android, and cross-platform repos',
    columns: [
      { name: 'iOS', color: '#3B82F6' },
      { name: 'Android', color: '#22C55E' },
      { name: 'Cross-Platform', color: '#A855F7' },
      { name: 'Backend', color: '#EF4444' },
      { name: 'Library', color: '#F59E0B' },
    ],
  },
  macos: {
    id: 'macos',
    label: 'macOS',
    description: 'macOS native application repos',
    columns: [
      { name: 'Native App', color: '#0EA5E9' },
      { name: 'Menu Bar', color: '#8B5CF6' },
      { name: 'Widget', color: '#F43F5E' },
      { name: 'Utility', color: '#14B8A6' },
      { name: 'System Extension', color: '#64748B' },
    ],
  },
} as const

/**
 * Get preset by ID with fallback to default.
 * @param id - Preset identifier string
 * @returns Matching BoardPreset, or default (web-app) if not found
 * @example
 * getPresetById('cli-tool')  // => { id: 'cli-tool', label: 'CLI Tool', ... }
 * getPresetById('unknown')   // => { id: 'web-app', label: 'Web App', ... }
 */
export function getPresetById(id: string): BoardPreset {
  return BOARD_PRESETS[id as PresetId] ?? BOARD_PRESETS[DEFAULT_PRESET_ID]
}
