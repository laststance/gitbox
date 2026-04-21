/**
 * Link Type Presets for ProjectInfo
 *
 * 55 built-in service presets organized into 12 categories.
 * Users can also create custom presets stored in user_link_presets table.
 */

import type {
  LinkPresetLabel,
  LinkPresetValue,
  LucideIconName,
} from '@/lib/types/domain-primitives'

/**
 * Category definitions for organizing link type presets
 */
export const LINK_TYPE_CATEGORIES = [
  'Hosting',
  'Cloud',
  'Database',
  'Storage',
  'Auth',
  'Email',
  'Monitoring',
  'Testing',
  'Project',
  'Docs',
  'Publishing',
  'Payment',
  'Custom',
] as const

export type LinkTypeCategory = (typeof LINK_TYPE_CATEGORIES)[number]

/**
 * Link type preset definition
 */
export interface LinkTypePreset {
  /** Unique identifier (kebab-case) */
  value: LinkPresetValue
  /** Display name */
  label: LinkPresetLabel
  /** Lucide icon name */
  icon: LucideIconName
  /** Category for grouping in dropdown */
  category: LinkTypeCategory
}

/**
 * Built-in link type presets (55 total)
 */
export const LINK_TYPE_PRESETS: readonly LinkTypePreset[] = [
  // ─────────────────────────────────────────
  // Hosting & Deployment (8)
  // ─────────────────────────────────────────
  { value: 'vercel', label: 'Vercel', icon: 'Triangle', category: 'Hosting' },
  { value: 'netlify', label: 'Netlify', icon: 'Cloud', category: 'Hosting' },
  {
    value: 'cloudflare',
    label: 'Cloudflare',
    icon: 'Cloud',
    category: 'Hosting',
  },
  { value: 'railway', label: 'Railway', icon: 'Train', category: 'Hosting' },
  { value: 'render', label: 'Render', icon: 'Server', category: 'Hosting' },
  { value: 'fly-io', label: 'Fly.io', icon: 'Plane', category: 'Hosting' },
  {
    value: 'digital-ocean',
    label: 'DigitalOcean',
    icon: 'Droplet',
    category: 'Hosting',
  },
  {
    value: 'docker-hub',
    label: 'Docker Hub',
    icon: 'Box',
    category: 'Hosting',
  },

  // ─────────────────────────────────────────
  // Cloud & Infrastructure (3)
  // ─────────────────────────────────────────
  { value: 'aws', label: 'AWS Console', icon: 'Cloud', category: 'Cloud' },
  {
    value: 'google-cloud',
    label: 'Google Cloud Console',
    icon: 'Cloud',
    category: 'Cloud',
  },
  { value: 'azure', label: 'Azure Console', icon: 'Cloud', category: 'Cloud' },

  // ─────────────────────────────────────────
  // Database (5)
  // ─────────────────────────────────────────
  {
    value: 'supabase',
    label: 'Supabase',
    icon: 'Database',
    category: 'Database',
  },
  {
    value: 'planetscale',
    label: 'PlanetScale',
    icon: 'Database',
    category: 'Database',
  },
  { value: 'neon', label: 'Neon', icon: 'Database', category: 'Database' },
  {
    value: 'upstash',
    label: 'Upstash',
    icon: 'Database',
    category: 'Database',
  },
  { value: 'firebase', label: 'Firebase', icon: 'Flame', category: 'Database' },

  // ─────────────────────────────────────────
  // Storage (5)
  // ─────────────────────────────────────────
  { value: 'aws-s3', label: 'AWS S3', icon: 'HardDrive', category: 'Storage' },
  {
    value: 'uploadthing',
    label: 'UploadThing',
    icon: 'Upload',
    category: 'Storage',
  },
  {
    value: 'cloudinary',
    label: 'Cloudinary',
    icon: 'Image',
    category: 'Storage',
  },
  {
    value: 'cloudflare-r2',
    label: 'Cloudflare R2',
    icon: 'HardDrive',
    category: 'Storage',
  },
  {
    value: 'backblaze',
    label: 'Backblaze B2',
    icon: 'HardDrive',
    category: 'Storage',
  },

  // ─────────────────────────────────────────
  // Auth & Identity (5)
  // ─────────────────────────────────────────
  { value: 'clerk', label: 'Clerk', icon: 'UserCheck', category: 'Auth' },
  { value: 'auth0', label: 'Auth0', icon: 'Shield', category: 'Auth' },
  { value: 'kinde', label: 'Kinde', icon: 'Key', category: 'Auth' },
  { value: 'workos', label: 'WorkOS', icon: 'Building', category: 'Auth' },
  { value: 'lucia', label: 'Lucia', icon: 'Lock', category: 'Auth' },

  // ─────────────────────────────────────────
  // Email (4)
  // ─────────────────────────────────────────
  { value: 'resend', label: 'Resend', icon: 'Mail', category: 'Email' },
  { value: 'sendgrid', label: 'SendGrid', icon: 'Mail', category: 'Email' },
  { value: 'postmark', label: 'Postmark', icon: 'Mail', category: 'Email' },
  { value: 'mailgun', label: 'Mailgun', icon: 'Mail', category: 'Email' },

  // ─────────────────────────────────────────
  // Monitoring & Observability (6)
  // ─────────────────────────────────────────
  {
    value: 'sentry',
    label: 'Sentry',
    icon: 'AlertTriangle',
    category: 'Monitoring',
  },
  {
    value: 'datadog',
    label: 'Datadog',
    icon: 'Activity',
    category: 'Monitoring',
  },
  {
    value: 'better-stack',
    label: 'Better Stack',
    icon: 'Layers',
    category: 'Monitoring',
  },
  {
    value: 'axiom',
    label: 'Axiom',
    icon: 'BarChart2',
    category: 'Monitoring',
  },
  {
    value: 'mixpanel',
    label: 'Mixpanel',
    icon: 'PieChart',
    category: 'Monitoring',
  },
  {
    value: 'google-analytics',
    label: 'Google Analytics',
    icon: 'TrendingUp',
    category: 'Monitoring',
  },

  // ─────────────────────────────────────────
  // Testing & Quality (3)
  // ─────────────────────────────────────────
  {
    value: 'codecov',
    label: 'Codecov',
    icon: 'CheckCircle',
    category: 'Testing',
  },
  {
    value: 'chromatic',
    label: 'Chromatic',
    icon: 'Image',
    category: 'Testing',
  },
  { value: 'argos', label: 'Argos CI', icon: 'Eye', category: 'Testing' },

  // ─────────────────────────────────────────
  // Project Management (5)
  // ─────────────────────────────────────────
  { value: 'jira', label: 'Jira', icon: 'Kanban', category: 'Project' },
  { value: 'linear', label: 'Linear', icon: 'Layers', category: 'Project' },
  { value: 'notion', label: 'Notion', icon: 'FileText', category: 'Project' },
  { value: 'asana', label: 'Asana', icon: 'CheckSquare', category: 'Project' },
  { value: 'trello', label: 'Trello', icon: 'Columns', category: 'Project' },

  // ─────────────────────────────────────────
  // Documentation & Design (4)
  // ─────────────────────────────────────────
  { value: 'confluence', label: 'Confluence', icon: 'Book', category: 'Docs' },
  { value: 'figma', label: 'Figma', icon: 'Figma', category: 'Docs' },
  {
    value: 'storybook',
    label: 'Storybook',
    icon: 'BookOpen',
    category: 'Docs',
  },
  {
    value: 'slack',
    label: 'Slack Channel',
    icon: 'MessageSquare',
    category: 'Docs',
  },

  // ─────────────────────────────────────────
  // Publishing & Distribution (6)
  // ─────────────────────────────────────────
  {
    value: 'production',
    label: 'Production URL',
    icon: 'Globe',
    category: 'Publishing',
  },
  { value: 'npm', label: 'npm', icon: 'Package', category: 'Publishing' },
  {
    value: 'chrome-web-store',
    label: 'Chrome Web Store',
    icon: 'Chrome',
    category: 'Publishing',
  },
  {
    value: 'app-store',
    label: 'App Store',
    icon: 'Apple',
    category: 'Publishing',
  },
  {
    value: 'google-play',
    label: 'Google Play Store',
    icon: 'Play',
    category: 'Publishing',
  },
  { value: 'steam', label: 'Steam', icon: 'Gamepad2', category: 'Publishing' },

  // ─────────────────────────────────────────
  // Payment (5)
  // ─────────────────────────────────────────
  {
    value: 'stripe',
    label: 'Stripe',
    icon: 'CreditCard',
    category: 'Payment',
  },
  { value: 'paypal', label: 'PayPal', icon: 'Wallet', category: 'Payment' },
  { value: 'paddle', label: 'Paddle', icon: 'CreditCard', category: 'Payment' },
  {
    value: 'lemon-squeezy',
    label: 'Lemon Squeezy',
    icon: 'Citrus',
    category: 'Payment',
  },
  { value: 'square', label: 'Square', icon: 'Square', category: 'Payment' },
] as const

/**
 * Map of preset values to their definitions for O(1) lookup
 */
export const LINK_TYPE_PRESETS_MAP = new Map<LinkPresetValue, LinkTypePreset>(
  LINK_TYPE_PRESETS.map((preset) => [preset.value, preset]),
)

/**
 * Get presets grouped by category
 *
 * @returns Object with category names as keys and arrays of presets as values
 */
export function getPresetsByCategory(): Record<
  LinkTypeCategory,
  LinkTypePreset[]
> {
  const grouped = {} as Record<LinkTypeCategory, LinkTypePreset[]>

  for (const category of LINK_TYPE_CATEGORIES) {
    grouped[category] = []
  }

  for (const preset of LINK_TYPE_PRESETS) {
    grouped[preset.category].push(preset)
  }

  return grouped
}

/**
 * Find a preset by its value
 *
 * @param value - The preset value to find
 * @returns The preset if found, undefined otherwise
 */
export function findPresetByValue(
  value: LinkPresetValue,
): LinkTypePreset | undefined {
  return LINK_TYPE_PRESETS_MAP.get(value)
}

/**
 * Check if a value is a built-in preset
 *
 * @param value - The value to check
 * @returns true if the value is a built-in preset
 */
export function isBuiltInPreset(value: LinkPresetValue): boolean {
  return LINK_TYPE_PRESETS_MAP.has(value)
}

/**
 * Convert a label to kebab-case value
 *
 * @param label - The label to convert
 * @returns Kebab-case value suitable for storage
 *
 * @example
 * labelToValue("My Custom Service") // => "my-custom-service"
 */
export function labelToValue(label: LinkPresetLabel): LinkPresetValue {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
