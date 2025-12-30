/**
 * Settings Client Component
 *
 * Manages theme, typography, and display settings
 */

'use client'

import { Check, Sun, Moon, Monitor } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { memo, useMemo, useCallback } from 'react'
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
import {
  type ThemeType,
  LIGHT_THEMES,
  DARK_THEMES,
  THEME_INFO,
} from '@/lib/constants/themes'
import { useTheme } from '@/lib/hooks/use-theme'
import {
  selectCompactMode,
  selectShowCardMetadata,
  setCompactMode,
  setShowCardMetadata,
} from '@/lib/redux/slices/settingsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
/** Base styles for the toggle switch container */
const TOGGLE_BASE =
  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/** Base styles for the toggle switch knob */
const TOGGLE_KNOB_BASE =
  'inline-block h-4 w-4 rounded-full bg-background shadow-lg transition-transform'

/**
 * Toggle Switch Component (Controlled)
 *
 * A controlled toggle switch that displays a boolean state.
 * @param id - Optional HTML id attribute for accessibility
 * @param checked - Current checked state
 * @param onCheckedChange - Callback when toggle is clicked
 */
const Toggle = memo(function Toggle({
  id,
  checked,
  onCheckedChange,
}: {
  id?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const containerClassName = useMemo(
    () => `${TOGGLE_BASE} ${checked ? 'bg-primary' : 'bg-input'}`,
    [checked],
  )

  const knobClassName = useMemo(
    () => `${TOGGLE_KNOB_BASE} ${checked ? 'translate-x-6' : 'translate-x-1'}`,
    [checked],
  )

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
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
          className={`h-10 w-10 rounded-full shadow-md ${info.needsBorder ? 'border border-gray-200' : ''}`}
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
  const dispatch = useAppDispatch()
  const { theme, setTheme, mounted } = useTheme()

  // Redux state for display settings
  const compactMode = useAppSelector(selectCompactMode)
  const showCardMetadata = useAppSelector(selectShowCardMetadata)

  /**
   * Handles compact mode toggle change.
   * Dispatches Redux action to update and persist the setting.
   */
  const handleCompactModeChange = useCallback(
    (value: boolean) => {
      dispatch(setCompactMode(value))
    },
    [dispatch],
  )

  /**
   * Handles show card metadata toggle change.
   * Dispatches Redux action to update and persist the setting.
   */
  const handleShowCardMetadataChange = useCallback(
    (value: boolean) => {
      dispatch(setShowCardMetadata(value))
    },
    [dispatch],
  )

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
              <Toggle
                id="compact-mode"
                checked={compactMode}
                onCheckedChange={handleCompactModeChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-card-metadata">Show Card Metadata</Label>
                <p className="text-sm text-muted-foreground">
                  Display stars, language, and last updated on cards
                </p>
              </div>
              <Toggle
                id="show-card-metadata"
                checked={showCardMetadata}
                onCheckedChange={handleShowCardMetadataChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Typography Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>
              Adjust text size for better readability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="font-size" className="mb-2 block">
                  Base Font Size
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
