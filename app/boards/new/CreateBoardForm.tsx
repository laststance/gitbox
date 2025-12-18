/**
 * Create Board Form Component
 *
 * Client Component for board creation
 * - Name input with validation
 * - Theme selection with preview colors
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBoard } from '@/lib/actions/board'
import { cn } from '@/lib/utils'

// Theme definitions from PRD
const THEMES = {
  light: [
    {
      id: 'sunrise',
      name: 'Sunrise',
      color: '#f59e0b',
      description: 'Warm amber tones',
    },
    {
      id: 'sandstone',
      name: 'Sandstone',
      color: '#a8a29e',
      description: 'Earthy neutral',
    },
    { id: 'mint', name: 'Mint', color: '#10b981', description: 'Fresh green' },
    { id: 'sky', name: 'Sky', color: '#0ea5e9', description: 'Calm blue' },
    {
      id: 'lavender',
      name: 'Lavender',
      color: '#a78bfa',
      description: 'Soft purple',
    },
    { id: 'rose', name: 'Rose', color: '#f43f5e', description: 'Vibrant pink' },
  ],
  dark: [
    {
      id: 'midnight',
      name: 'Midnight',
      color: '#1e40af',
      description: 'Deep blue',
    },
    {
      id: 'graphite',
      name: 'Graphite',
      color: '#374151',
      description: 'Dark gray',
    },
    {
      id: 'forest',
      name: 'Forest',
      color: '#166534',
      description: 'Dark green',
    },
    { id: 'ocean', name: 'Ocean', color: '#0c4a6e', description: 'Deep teal' },
    { id: 'plum', name: 'Plum', color: '#7e22ce', description: 'Rich purple' },
    { id: 'rust', name: 'Rust', color: '#9a3412', description: 'Dark orange' },
  ],
}

export function CreateBoardForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [theme, setTheme] = useState('sunrise')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Board name is required')
      return
    }

    if (name.trim().length > 50) {
      setError('Board name must be 50 characters or less')
      return
    }

    startTransition(async () => {
      try {
        const board = await createBoard(name.trim(), theme)
        router.push(`/board/${board.id}`)
      } catch (err) {
        console.error('Failed to create board:', err)
        setError(err instanceof Error ? err.message : 'Failed to create board')
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
            {THEMES.light.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                disabled={isPending}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all',
                  theme === t.id
                    ? 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <div
                  className="h-8 w-8 rounded-full shadow-inner"
                  style={{ backgroundColor: t.color }}
                />
                <span className="text-xs font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dark Themes */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Dark</p>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.dark.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                disabled={isPending}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all',
                  theme === t.id
                    ? 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <div
                  className="h-8 w-8 rounded-full shadow-inner"
                  style={{ backgroundColor: t.color }}
                />
                <span className="text-xs font-medium">{t.name}</span>
              </button>
            ))}
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
}
