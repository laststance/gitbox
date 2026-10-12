/**
 * Create Board Form Component
 *
 * Client Component for board creation.
 * - Name input with validation
 * - Preset selector for status list column templates
 * - A creation that could not be confirmed (by the server, or because the
 *   request failed on the way or got no answer in time) is worded as that and
 *   ends the form: the board may exist and a second try could make a second
 *   board, so "Open your boards" takes the place of "Create Board"
 */

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition, memo } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEFAULT_PRESET_ID,
  type SelectablePresetId,
} from '@/lib/constants/board-presets'
import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'
import { requestBoardCreation } from '@/lib/utils/request-board-creation'
import { BOARD_NAME_MAX_LENGTH, boardNameSchema } from '@/lib/validations/board'

import { PresetSelector } from './PresetSelector'

/** Ids of the texts the name field and the preset group are described by. */
const NAME_HINT_ID = 'board-name-hint'
const PROBLEM_TEXT_ID = 'create-board-problem'
const PRESET_LABEL_ID = 'board-preset-label'
const PRESET_HINT_ID = 'board-preset-hint'

/**
 * What the form shows above its buttons.
 * - `invalid-name`: the name did not pass the check, so nothing was sent
 * - `not-created`: the server answered and no board was created
 * - `unconfirmed`: a board may exist; "Open your boards" takes the place of
 *   "Create Board" and nothing more is sent from this form
 */
interface FormProblem {
  kind: 'invalid-name' | 'not-created' | 'unconfirmed'
  message: string
}

export const CreateBoardForm = memo(function CreateBoardForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [presetId, setPresetId] =
    useState<SelectablePresetId>(DEFAULT_PRESET_ID)
  const [problem, setProblem] = useState<FormProblem | null>(null)

  const nameFieldRef = useRef<HTMLInputElement>(null)

  const isOutcomeUnknown = problem?.kind === 'unconfirmed'

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    // The board may exist: a second creation could make a second board
    if (isOutcomeUnknown) return
    setProblem(null)

    // Validate using Zod schema (same as server-side)
    const nameValidation = boardNameSchema.safeParse(name)
    if (!nameValidation.success) {
      setProblem({
        kind: 'invalid-name',
        message:
          nameValidation.error.issues[0]?.message || 'Invalid board name',
      })
      nameFieldRef.current?.focus()
      return
    }

    const validatedName = nameValidation.data

    startTransition(async () => {
      // Never rejects and never waits without end: a rejection here would
      // put the error page of the route in place of the form
      const attempt = await requestBoardCreation(validatedName, presetId)
      if (attempt.status === 'created') {
        toast.success('Board created', {
          description: `"${validatedName}" has been created.`,
        })
        router.push(`/board/${attempt.board.id}`)
        return
      }

      setProblem({ kind: attempt.status, message: attempt.message })
      // "Could not confirm" is no failure to create
      toast.error(
        attempt.status === 'unconfirmed'
          ? 'Board creation not confirmed'
          : 'Failed to create board',
        { description: attempt.message },
      )
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Board Name */}
      <div className="space-y-2">
        <Label htmlFor="board-name">Board Name</Label>
        <Input
          ref={nameFieldRef}
          id="board-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            // The message was about the name as it was before this edit
            setProblem(null)
          }}
          placeholder="e.g., AI Experiments, Side Projects"
          maxLength={BOARD_NAME_MAX_LENGTH}
          autoFocus
          // After an unknown outcome the name is not sent a second time
          disabled={isPending || isOutcomeUnknown}
          // Only a name that failed the check is invalid; a refusal of the
          // server says nothing about the name
          aria-invalid={problem?.kind === 'invalid-name'}
          aria-describedby={
            problem ? `${NAME_HINT_ID} ${PROBLEM_TEXT_ID}` : NAME_HINT_ID
          }
        />
        <p id={NAME_HINT_ID} className="text-muted-foreground text-xs">
          {name.length}/{BOARD_NAME_MAX_LENGTH} characters
        </p>
        {/* What is wrong with the name stands under the name; what the
            server answered stands above the buttons that were pressed */}
        {problem?.kind === 'invalid-name' && (
          <p
            id={PROBLEM_TEXT_ID}
            role="alert"
            className="text-destructive text-sm"
          >
            {problem.message}
          </p>
        )}
      </div>

      {/* Preset Selection */}
      <div className="space-y-2">
        <Label id={PRESET_LABEL_ID}>Column Preset</Label>
        <p id={PRESET_HINT_ID} className="text-muted-foreground text-xs">
          Choose how to organize your repos
        </p>
        <PresetSelector
          value={presetId}
          onChange={setPresetId}
          disabled={isPending || isOutcomeUnknown}
          aria-labelledby={PRESET_LABEL_ID}
          aria-describedby={PRESET_HINT_ID}
        />
      </div>

      {/* Error Message */}
      {problem && problem.kind !== 'invalid-name' && (
        <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-3">
          <p
            id={PROBLEM_TEXT_ID}
            role="alert"
            className="text-destructive text-sm"
          >
            {problem.message}
          </p>
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
        {isOutcomeUnknown ? (
          // The text above says "check your boards": this is the way there.
          // It takes the keyboard the disabled form let go of.
          <Button asChild className="flex-1">
            <Link ref={focusWhenShown} href="/boards">
              Open your boards
            </Link>
          </Button>
        ) : (
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Creating...' : 'Create Board'}
          </Button>
        )}
      </div>
    </form>
  )
}, areServerRenderedPropsEqual)

/**
 * Ref callback that puts the keyboard focus on an element when React adds it
 * to the page. Defined outside the component so it stays the same function:
 * React calls a new one on every render, and the focus would jump back each
 * time.
 *
 * @param element - The element that was added, or `null` when it is removed.
 * @example
 * <Link ref={focusWhenShown} href="/boards">Open your boards</Link>
 */
function focusWhenShown(element: HTMLElement | null): void {
  element?.focus()
}
