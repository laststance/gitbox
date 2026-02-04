/**
 * Create Board Form Component
 *
 * Client Component for board creation
 * - Name input with validation
 */

'use client'

import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useState, useTransition, memo } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBoard } from '@/lib/actions/board'
import { boardNameSchema } from '@/lib/validations/board'

export const CreateBoardForm = memo(function CreateBoardForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
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
      try {
        const board = await createBoard(validatedName)
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
