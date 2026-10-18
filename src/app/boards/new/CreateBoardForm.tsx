/**
 * Create Board Form Component
 *
 * Client Component for board creation.
 * - Name input with validation
 * - Preset selector for status list column templates
 * - A problem is said once, in the form: under the name when the name is
 *   wrong, above the buttons when the server answered. No toast repeats it
 * - A creation that could not be confirmed (by the server, or because the
 *   request failed on the way or got no answer in time) is worded as that and
 *   ends the form: the board may exist and a second try could make a second
 *   board, so "Open your boards" takes the place of "Create Board"
 * - A page whose action the server no longer has ends the form too: nothing
 *   was written, and sending it again from this page fails the same way, so
 *   "Reload page" takes the place of "Create Board"
 * - The field and the buttons are disabled while the request runs, and a
 *   disabled control loses the focus. Each ending hands it to the control
 *   needed next: the name field after a refusal, "Open your boards" after a
 *   creation that could not be confirmed, "Reload page" when this page is
 *   out of date
 */

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, memo } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEFAULT_PRESET_ID,
  type SelectablePresetId,
} from '@/lib/constants/board-presets'
import {
  OUTCOME_UNKNOWN_BOX_CLASS,
  OUTCOME_UNKNOWN_TEXT_CLASS,
} from '@/lib/constants/outcome-unknown'
import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'
import { reloadPage } from '@/lib/utils/reload-page'
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
 * - `out-of-date`: this page's action is gone; nothing was written, and
 *   "Reload page" takes the place of "Create Board"
 */
interface FormProblem {
  kind: 'invalid-name' | 'not-created' | 'unconfirmed' | 'out-of-date'
  message: string
}

export const CreateBoardForm = memo(function CreateBoardForm() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [name, setName] = useState('')
  const [presetId, setPresetId] =
    useState<SelectablePresetId>(DEFAULT_PRESET_ID)
  const [problem, setProblem] = useState<FormProblem | null>(null)

  const formRef = useRef<HTMLFormElement>(null)
  const nameFieldRef = useRef<HTMLInputElement>(null)
  const boardsLinkRef = useRef<HTMLAnchorElement>(null)
  const reloadButtonRef = useRef<HTMLButtonElement>(null)

  const isOutcomeUnknown = problem?.kind === 'unconfirmed'
  // A second send from this page is wrong for both: a board may exist, or
  // the action this page has is gone
  const isFormClosed =
    problem?.kind === 'unconfirmed' || problem?.kind === 'out-of-date'

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (isFormClosed) return
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

    setIsPending(true)
    // Never rejects and never waits without end: a rejection here would
    // put the error page of the route in place of the form
    const attempt = await requestBoardCreation(validatedName, presetId)
    if (attempt.status === 'created') {
      toast.success('Board created', {
        description: `"${validatedName}" has been created.`,
      })
      // Still pending: the form stays locked until the board takes its place
      router.push(`/board/${attempt.board.id}`)
      return
    }

    // Said once, in the form, next to the buttons: a toast with the same
    // words lands on those buttons on a laptop screen.
    // flushSync: once this returns the field is enabled again after a
    // refusal, and the way on is on the page after the form has closed
    flushSync(() => {
      setIsPending(false)
      setProblem({ kind: attempt.status, message: attempt.message })
    })
    // The form let go of the focus when it disabled its controls for the
    // request. A user who went on to the sidebar meanwhile stays there
    if (!isFocusLostByForm(formRef.current)) return
    if (attempt.status === 'not-created') {
      // After a refusal the name is what the user can change
      nameFieldRef.current?.focus()
    } else if (attempt.status === 'out-of-date') {
      // This page cannot create the board: reload loads the current build
      reloadButtonRef.current?.focus()
    } else {
      // The board may exist: the way to the boards is the next step
      boardsLinkRef.current?.focus()
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
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
          // After the form has closed the name is not sent a second time
          disabled={isPending || isFormClosed}
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
          disabled={isPending || isFormClosed}
          aria-labelledby={PRESET_LABEL_ID}
          aria-describedby={PRESET_HINT_ID}
        />
      </div>

      {/* Error Message */}
      {problem && problem.kind !== 'invalid-name' && (
        <div
          className={`rounded-lg border p-3 ${
            problem.kind === 'unconfirmed'
              ? OUTCOME_UNKNOWN_BOX_CLASS
              : 'bg-destructive/10 border-destructive/20'
          }`}
        >
          <p
            id={PROBLEM_TEXT_ID}
            role="alert"
            className={`text-sm ${
              problem.kind === 'unconfirmed'
                ? OUTCOME_UNKNOWN_TEXT_CLASS
                : 'text-destructive'
            }`}
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
        {problem?.kind === 'out-of-date' ? (
          // This page's action is gone. Reloading loads the build that has it.
          // Described by the message: a screen reader that follows the focus
          // reads why the button took the place of "Create Board".
          <Button
            type="button"
            ref={reloadButtonRef}
            className="flex-1"
            aria-describedby={PROBLEM_TEXT_ID}
            onClick={reloadPage}
          >
            Reload page
          </Button>
        ) : isOutcomeUnknown ? (
          // The text above says "check your boards": this is the way there.
          // handleSubmit gives it the keyboard the disabled form let go of.
          // Described by that text: a screen reader that follows the focus
          // reads why the link took the place of "Create Board".
          <Button asChild className="flex-1">
            <Link
              ref={boardsLinkRef}
              href="/boards"
              aria-describedby={PROBLEM_TEXT_ID}
            >
              Open your boards
            </Link>
          </Button>
        ) : (
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Creating…' : 'Create Board'}
          </Button>
        )}
      </div>
    </form>
  )
}, areServerRenderedPropsEqual)

/**
 * Says whether the keyboard focus is where the form left it when it disabled
 * its controls: on nothing, or still on one of the form's own controls.
 * Called when a creation has ended without a board to open, before the name
 * field or "Open your boards" takes the focus, so a user who went on to the
 * sidebar meanwhile is not pulled back.
 *
 * @param form - The form element, or `null` before it is mounted.
 * @returns
 * - `true` when no element has the focus (the browser reports the body), or
 *   when a control of the form still has it
 * - `false` when the user moved the focus to something outside the form
 * @example
 * // The pressed "Create Board" button was disabled and let go of the focus
 * isFocusLostByForm(form) // => true
 */
function isFocusLostByForm(form: HTMLFormElement | null): boolean {
  const focusedElement = document.activeElement
  return (
    focusedElement === null ||
    focusedElement === document.body ||
    Boolean(form?.contains(focusedElement))
  )
}
