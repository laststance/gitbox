/**
 * Create Board Form Component
 *
 * Client Component for board creation.
 * - Name input with validation
 * - Preset selector for status list column templates
 */

'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, memo } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBoard } from '@/lib/actions/board'
import { DEFAULT_PRESET_ID, type PresetId } from '@/lib/constants/board-presets'
import { boardNameSchema } from '@/lib/validations/board'

import { PresetSelector } from './PresetSelector'

export const CreateBoardForm = memo(function CreateBoardForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET_ID)
  const [error, setError] = useState<string | null>(null)

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
      const result = await createBoard(validatedName, presetId)
      if (result.success) {
        toast.success('Board created', {
          description: `"${validatedName}" has been created.`,
        })
        router.push(`/board/${result.data.id}`)
      } else {
        setError(result.error)
        toast.error('Failed to create board', {
          description: result.error,
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
        <p className="text-muted-foreground text-xs">
          {name.length}/50 characters
        </p>
      </div>

      {/* Preset Selection */}
      <div className="space-y-2">
        <Label>Column Preset</Label>
        <p className="text-muted-foreground text-xs">
          Choose how to organize your repos
        </p>
        <PresetSelector
          value={presetId}
          onChange={setPresetId}
          disabled={isPending}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-3">
          <p className="text-destructive text-sm">{error}</p>
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
