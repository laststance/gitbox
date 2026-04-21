/**
 * Settings Client Component
 *
 * Manages display settings (compact mode, card metadata).
 * Theme selection is handled via the sidebar ThemeToggle.
 */

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { memo } from 'react'
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
import { useMounted } from '@/hooks/use-mounted'
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
  const containerClassName = `${TOGGLE_BASE} ${checked ? 'bg-primary' : 'bg-input'}`

  const knobClassName = `${TOGGLE_KNOB_BASE} ${checked ? 'translate-x-6' : 'translate-x-1'}`

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

export const SettingsClient = memo(function SettingsClient() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const mounted = useMounted()

  const compactMode = useAppSelector(selectCompactMode)
  const showCardMetadata = useAppSelector(selectShowCardMetadata)

  const handleSaveSettings = () => {
    toast.success('Settings saved', {
      description: 'Your preferences have been updated.',
    })
    router.push('/boards')
  }

  if (!mounted) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="bg-muted h-8 w-48 rounded" />
          <div className="bg-muted h-64 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Customize your GitBox experience
        </p>
      </div>

      <div className="space-y-6">
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
                <p className="text-muted-foreground text-sm">
                  Reduce spacing and card sizes for more content on screen
                </p>
              </div>
              <Toggle
                id="compact-mode"
                checked={compactMode}
                onCheckedChange={(value) => dispatch(setCompactMode(value))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-card-metadata">Show Card Metadata</Label>
                <p className="text-muted-foreground text-sm">
                  Display stars, language, and last updated on cards
                </p>
              </div>
              <Toggle
                id="show-card-metadata"
                checked={showCardMetadata}
                onCheckedChange={(value) =>
                  dispatch(setShowCardMetadata(value))
                }
              />
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
