/**
 * Create Board Form Component
 *
 * Client Component for board creation
 * - Name input with validation
 * - Theme selection with preview colors
 */

'use client'

import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import {
  useState,
  useTransition,
  memo,
  useMemo,
  useEffect,
  useRef,
} from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBoard } from '@/lib/actions/board'
import {
  LIGHT_THEME_IDS,
  DARK_THEME_IDS,
  THEME_METADATA,
  isDarkTheme,
  type ThemeId,
} from '@/lib/constants/themes'
import { boardNameSchema } from '@/lib/validations/board'

/** Theme button base styles */
const THEME_BUTTON_BASE =
  'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all'
const THEME_BUTTON_SELECTED =
  'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2'
const THEME_BUTTON_UNSELECTED = 'border-border hover:border-primary/50'

/**
 * Computes className for a theme button based on selection state.
 * @param isSelected - Whether this theme is currently selected.
 * @returns The combined className string.
 */
const getThemeButtonClassName = (isSelected: boolean): string =>
  `${THEME_BUTTON_BASE} ${isSelected ? THEME_BUTTON_SELECTED : THEME_BUTTON_UNSELECTED}`

export const CreateBoardForm = memo(function CreateBoardForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [theme, setTheme] = useState('default')
  const [error, setError] = useState<string | null>(null)

  /** Store original theme to restore on unmount */
  const originalThemeRef = useRef<string | null>(null)
  const originalDarkClassRef = useRef<boolean>(false)

  /**
   * Theme Preview Effect
   * Applies selected theme to the page so users can see what they're choosing.
   * Restores original theme when leaving the page.
   */
  useEffect(() => {
    const root = document.documentElement

    // Capture original theme state on first render
    if (originalThemeRef.current === null) {
      originalThemeRef.current = root.getAttribute('data-theme')
      originalDarkClassRef.current = root.classList.contains('dark')
    }

    // Apply preview theme
    root.setAttribute('data-theme', theme)

    // Handle dark class for dark themes
    if (isDarkTheme(theme as ThemeId)) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // Cleanup: restore original theme on unmount
    return () => {
      if (originalThemeRef.current) {
        root.setAttribute('data-theme', originalThemeRef.current)
      } else {
        root.removeAttribute('data-theme')
      }
      if (originalDarkClassRef.current) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [theme])

  /** Memoized classNames for light theme buttons based on current theme selection */
  const lightThemeClassNames = useMemo(
    () =>
      LIGHT_THEME_IDS.map((id) => ({
        id,
        className: getThemeButtonClassName(theme === id),
      })),
    [theme],
  )

  /** Memoized classNames for dark theme buttons based on current theme selection */
  const darkThemeClassNames = useMemo(
    () =>
      DARK_THEME_IDS.map((id) => ({
        id,
        className: getThemeButtonClassName(theme === id),
      })),
    [theme],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate using Zod schema (same as server-side)
    const result = boardNameSchema.safeParse(name)
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Invalid board name')
      return
    }

    const validatedName = result.data

    startTransition(async () => {
      try {
        const board = await createBoard(validatedName, theme)
        toast.success('Board created', {
          description: `"${validatedName}" has been created.`,
        })
        router.push(`/board/${board.id}`)
      } catch (err) {
        Sentry.captureException(err, { tags: { action: 'createBoard' } })
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create board'
        setError(errorMessage)
        toast.error('Failed to create board', {
          description: errorMessage,
        })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Board Name */}
      <div className="space-y-2">
        <Label htmlFor="board-name">Board Name</Label>
        <Input
          id="board-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., AI Experiments, Side Projects"
          maxLength={50}
          autoFocus
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          {name.length}/50 characters
        </p>
      </div>

      {/* Theme Selection */}
      <div className="space-y-4">
        <Label>Theme</Label>

        {/* Light Themes */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Light</p>
          <div className="grid grid-cols-3 gap-3">
            {LIGHT_THEME_IDS.map((id) => {
              const meta = THEME_METADATA[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  disabled={isPending}
                  className={
                    lightThemeClassNames.find((c) => c.id === id)?.className
                  }
                >
                  <div
                    className={`h-8 w-8 rounded-full shadow-inner ${meta.needsBorder ? 'border border-gray-200 shadow-sm' : ''}`}
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="text-xs font-medium">{meta.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Dark Themes */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Dark</p>
          <div className="grid grid-cols-3 gap-3">
            {DARK_THEME_IDS.map((id) => {
              const meta = THEME_METADATA[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  disabled={isPending}
                  className={
                    darkThemeClassNames.find((c) => c.id === id)?.className
                  }
                >
                  <div
                    className="h-8 w-8 rounded-full shadow-inner"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="text-xs font-medium">{meta.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending ? 'Creating...' : 'Create Board'}
        </Button>
      </div>
    </form>
  )
})
