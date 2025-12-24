/**
 * Settings Client Component
 *
 * Manages theme, typography, and display settings
 */

'use client'

import { Check, Sun, Moon, Monitor, Globe } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, memo, useMemo, useCallback } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import type { ThemeType } from '@/lib/hooks/use-theme'
import { useTheme, LIGHT_THEMES, DARK_THEMES } from '@/lib/hooks/use-theme'
import { useI18n } from '@/lib/i18n'
/** Base styles for the toggle switch container */
const TOGGLE_BASE =
  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/** Base styles for the toggle switch knob */
const TOGGLE_KNOB_BASE =
  'inline-block h-4 w-4 rounded-full bg-background shadow-lg transition-transform'

// Simple Toggle Switch Component
const Toggle = memo(function Toggle({
  id,
  checked,
  onCheckedChange,
  defaultChecked,
}: {
  id?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  defaultChecked?: boolean
}) {
  const [internalChecked, setInternalChecked] = useState(
    defaultChecked ?? false,
  )
  const isChecked = checked !== undefined ? checked : internalChecked

  const handleClick = () => {
    const newValue = !isChecked
    setInternalChecked(newValue)
    onCheckedChange?.(newValue)
  }

  const containerClassName = useMemo(
    () => `${TOGGLE_BASE} ${isChecked ? 'bg-primary' : 'bg-input'}`,
    [isChecked],
  )

  const knobClassName = useMemo(
    () =>
      `${TOGGLE_KNOB_BASE} ${isChecked ? 'translate-x-6' : 'translate-x-1'}`,
    [isChecked],
  )

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={isChecked}
      onClick={handleClick}
      className={containerClassName}
    >
      <span className={knobClassName} />
    </button>
  )
})

/** Base styles for theme button */
const THEME_BUTTON_BASE =
  'relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all'
const THEME_BUTTON_SELECTED =
  'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2'
const THEME_BUTTON_UNSELECTED =
  'border-border hover:border-primary/50 hover:bg-muted/50'

/** Base styles for language button */
const LANGUAGE_BUTTON_BASE =
  'flex items-center gap-2 rounded-lg border-2 px-4 py-3 transition-all'
const LANGUAGE_BUTTON_SELECTED =
  'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2'
const LANGUAGE_BUTTON_UNSELECTED = 'border-border hover:border-primary/50'

const THEME_INFO: Record<
  ThemeType,
  { name: string; color: string; description: string }
> = {
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
  midnight: { name: 'Midnight', color: '#1e40af', description: 'Deep blue' },
  graphite: { name: 'Graphite', color: '#374151', description: 'Dark gray' },
  forest: { name: 'Forest', color: '#166534', description: 'Dark green' },
  ocean: { name: 'Ocean', color: '#0c4a6e', description: 'Deep teal' },
  plum: { name: 'Plum', color: '#7e22ce', description: 'Rich purple' },
  rust: { name: 'Rust', color: '#9a3412', description: 'Dark orange' },
  system: {
    name: 'System',
    color: '#6b7280',
    description: 'Follow system preference',
  },
}

const ThemeButton = memo(function ThemeButton({
  theme,
  isSelected,
  onClick,
}: {
  theme: ThemeType
  isSelected: boolean
  onClick: () => void
}) {
  const info = THEME_INFO[theme]

  const buttonClassName = useMemo(
    () =>
      `${THEME_BUTTON_BASE} ${isSelected ? THEME_BUTTON_SELECTED : THEME_BUTTON_UNSELECTED}`,
    [isSelected],
  )

  return (
    <button type="button" onClick={onClick} className={buttonClassName}>
      {theme === 'system' ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Monitor className="h-5 w-5 text-muted-foreground" />
        </div>
      ) : (
        <div
          className="h-10 w-10 rounded-full shadow-md"
          style={{ backgroundColor: info.color }}
        />
      )}
      <span className="text-sm font-medium">{info.name}</span>
      <span className="text-xs text-muted-foreground">{info.description}</span>
      {isSelected && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
    </button>
  )
})

export const SettingsClient = memo(function SettingsClient() {
  const router = useRouter()
  const { theme, setTheme, mounted } = useTheme()
  const { language, setLanguage, t } = useI18n()

  /**
   * Handles the save settings action.
   * Shows a success toast and navigates to the boards page.
   */
  const handleSaveSettings = useCallback(() => {
    toast.success('Settings saved', {
      description: 'Your preferences have been updated.',
    })
    router.push('/boards')
  }, [router])

  const englishButtonClassName = useMemo(
    () =>
      `${LANGUAGE_BUTTON_BASE} ${language === 'en' ? LANGUAGE_BUTTON_SELECTED : LANGUAGE_BUTTON_UNSELECTED}`,
    [language],
  )

  const japaneseButtonClassName = useMemo(
    () =>
      `${LANGUAGE_BUTTON_BASE} ${language === 'ja' ? LANGUAGE_BUTTON_SELECTED : LANGUAGE_BUTTON_UNSELECTED}`,
    [language],
  )

  if (!mounted) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Customize your GitBox experience
        </p>
      </div>

      <div className="space-y-6">
        {/* Theme Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Theme
            </CardTitle>
            <CardDescription>
              Choose a theme that matches your style. Light themes work best in
              bright environments, dark themes reduce eye strain in low light.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* System Theme */}
            <div>
              <Label className="mb-3 block text-sm font-medium">System</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <ThemeButton
                  theme="system"
                  isSelected={theme === 'system'}
                  onClick={() => setTheme('system')}
                />
              </div>
            </div>

            {/* Light Themes */}
            <div>
              <Label className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Sun className="h-4 w-4" />
                Light Themes
              </Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {LIGHT_THEMES.map((t) => (
                  <ThemeButton
                    key={t}
                    theme={t}
                    isSelected={theme === t}
                    onClick={() => setTheme(t)}
                  />
                ))}
              </div>
            </div>

            {/* Dark Themes */}
            <div>
              <Label className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Moon className="h-4 w-4" />
                Dark Themes
              </Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {DARK_THEMES.map((t) => (
                  <ThemeButton
                    key={t}
                    theme={t}
                    isSelected={theme === t}
                    onClick={() => setTheme(t)}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Display</CardTitle>
            <CardDescription>
              Configure how content is displayed in your boards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="compact-mode">Compact Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Reduce spacing and card sizes for more content on screen
                </p>
              </div>
              <Toggle id="compact-mode" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-card-metadata">Show Card Metadata</Label>
                <p className="text-sm text-muted-foreground">
                  Display stars, language, and last updated on cards
                </p>
              </div>
              <Toggle id="show-card-metadata" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-wip-warnings">WIP Limit Warnings</Label>
                <p className="text-sm text-muted-foreground">
                  Show visual warnings when WIP limits are exceeded
                </p>
              </div>
              <Toggle id="show-wip-warnings" defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Typography Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.typography}</CardTitle>
            <CardDescription>
              {t.settings.typographyDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="font-size" className="mb-2 block">
                  {t.settings.fontSize}
                </Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">12px</span>
                  <input
                    type="range"
                    id="font-size"
                    min={12}
                    max={20}
                    defaultValue={16}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">20px</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Language / 言語
            </CardTitle>
            <CardDescription>Choose your preferred language</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={englishButtonClassName}
              >
                <span className="text-2xl">🇺🇸</span>
                <div className="text-left">
                  <span className="block font-medium">English</span>
                  <span className="text-xs text-muted-foreground">English</span>
                </div>
                {language === 'en' && (
                  <Check className="ml-2 h-4 w-4 text-primary" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ja')}
                className={japaneseButtonClassName}
              >
                <span className="text-2xl">🇯🇵</span>
                <div className="text-left">
                  <span className="block font-medium">日本語</span>
                  <span className="text-xs text-muted-foreground">
                    Japanese
                  </span>
                </div>
                {language === 'ja' && (
                  <Check className="ml-2 h-4 w-4 text-primary" />
                )}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Link href="/boards">
            <Button variant="outline">Back to Boards</Button>
          </Link>
          <Button onClick={handleSaveSettings}>Save Settings</Button>
        </div>
      </div>
    </div>
  )
})
