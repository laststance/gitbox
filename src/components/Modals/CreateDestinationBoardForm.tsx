/**
 * Create Destination Board Form
 *
 * The form inside {@link MoveToAnotherBoardDialog} that makes a new board to
 * move a card to: one field for the name and a "Create Board" button. It is
 * shown when the user has no other board, and when they press "New Board..."
 * although they have some.
 */

'use client'

import { LayoutGrid, Loader2 } from 'lucide-react'
import { memo, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { reloadPage } from '@/lib/utils/reload-page'
import { BOARD_NAME_MAX_LENGTH, boardNameSchema } from '@/lib/validations/board'

/** Id of the name field; its label, hint and error text point to it. */
const NAME_FIELD_ID = 'destination-board-name'
const NAME_HINT_ID = `${NAME_FIELD_ID}-hint`
const NAME_ERROR_ID = `${NAME_FIELD_ID}-error`

/** Why a creation the form asked for ended without a board to select. */
export interface BoardCreationFailure {
  /** Text shown under the name field. */
  message: string
  /**
   * What the form offers after it.
   * - `try-again`: the server answered and nothing was written, so "Create
   *   Board" stays and the name can be sent again
   * - `reload-boards`: a board may exist (the request failed on the way, or
   *   the server could not confirm it). A second try could make a second
   *   board, so "Reload boards" takes the place of "Create Board"
   * - `reload-page`: a board may exist and the request got no answer in
   *   time. It is still running, and loading the boards again would wait
   *   behind it, so "Reload page", which waits for nothing, takes that place
   */
  nextStep: 'try-again' | UnconfirmedCreationRecovery
}

/** The way out of the form after a creation with an unknown outcome. */
type UnconfirmedCreationRecovery = 'reload-boards' | 'reload-page'

/**
 * What the form shows under the name field.
 * - `invalid-name`: the name did not pass the check, so nothing was sent
 * - `not-created`: the server answered and no board was created
 * - `unconfirmed`: a board may exist; the button of `recovery` takes the
 *   place of "Create Board"
 */
type FormProblem =
  | { kind: 'invalid-name' | 'not-created'; message: string }
  | {
      kind: 'unconfirmed'
      message: string
      recovery: UnconfirmedCreationRecovery
    }

interface CreateDestinationBoardFormProps {
  /**
   * `true` while the board is being created. The dialog owns this flag
   * because it also keeps itself open for that time; here it disables the
   * field and both buttons.
   */
  isCreating: boolean
  /**
   * Creates a board from the typed name. Resolves with `null` when the board
   * exists (the dialog shows the board list again and this form is gone), or
   * with the {@link BoardCreationFailure} to show. `isCreating` is `false` on
   * screen by the time it resolves, so the form can take the focus back.
   */
  createBoardAction: (boardName: string) => Promise<BoardCreationFailure | null>
  /**
   * Loads the boards again and shows them. Offered after a creation with an
   * unknown outcome whose request has ended: the list on screen may lack a
   * board that exists.
   */
  onReloadBoards: () => void
  /**
   * Goes back to the list of existing boards. Left out when the user has no
   * other board, so there is nothing to go back to.
   */
  onChooseExisting?: () => void
  /**
   * Id of a text outside the form that says why it is shown. The name field
   * is described by it, so a screen reader reads it with the field.
   */
  introductionId?: string
}

/**
 * Name field and "Create Board" button for a board made inside the move
 * dialog. Keeps what the user typed when the creation fails and shows the
 * reason under the field.
 *
 * The field suggests no name: a default such as "Archive" would make one
 * kind of board look special, and a board is a board.
 *
 * @param isCreating - Disables the form while the board is being created.
 * @param createBoardAction - Creates the board; resolves with the failure or `null`.
 * @param onReloadBoards - Loads the boards again after an unknown outcome.
 * @param onChooseExisting - Shows "Choose an existing board" when given.
 * @param introductionId - Id of the text that introduces the form, if any.
 * @example
 * <CreateDestinationBoardForm
 *   isCreating={false}
 *   createBoardAction={async (boardName) =>
 *     (await createBoard(boardName, 'single-column')).success
 *       ? null
 *       : { message: 'The board was not created. Try again.', nextStep: 'try-again' }
 *   }
 *   onReloadBoards={reloadDestinations}
 *   onChooseExisting={() => setIsCreateFormRequested(false)}
 * />
 */
export const CreateDestinationBoardForm = memo(
  function CreateDestinationBoardForm({
    isCreating,
    createBoardAction,
    onReloadBoards,
    onChooseExisting,
    introductionId,
  }: CreateDestinationBoardFormProps) {
    const [boardName, setBoardName] = useState('')
    const [problem, setProblem] = useState<FormProblem | null>(null)

    const nameFieldRef = useRef<HTMLInputElement>(null)
    const recoveryButtonRef = useRef<HTMLButtonElement>(null)

    const isOutcomeUnknown = problem?.kind === 'unconfirmed'

    const handleSubmit = async (
      event: FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault()
      setProblem(null)

      // Same schema as the server: an empty or too long name needs no request
      const nameValidation = boardNameSchema.safeParse(boardName)
      if (!nameValidation.success) {
        setProblem({
          kind: 'invalid-name',
          message:
            nameValidation.error.issues[0]?.message || 'Invalid board name',
        })
        nameFieldRef.current?.focus()
        return
      }

      const failure = await createBoardAction(nameValidation.data)
      if (!failure) return

      // flushSync: the control that takes the focus exists and is enabled
      // once this returns. The field lost the focus when it was disabled for
      // the request.
      flushSync(() => setProblem(toFormProblem(failure)))
      if (failure.nextStep === 'try-again') nameFieldRef.current?.focus()
      else recoveryButtonRef.current?.focus()
    }

    return (
      <form onSubmit={handleSubmit} noValidate className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor={NAME_FIELD_ID} className="flex items-center gap-2">
            <LayoutGrid className="text-muted-foreground h-4 w-4" />
            Board Name
          </Label>
          <Input
            ref={nameFieldRef}
            id={NAME_FIELD_ID}
            value={boardName}
            onChange={(event) => {
              setBoardName(event.target.value)
              // The message was about the name as it was before this edit
              setProblem(null)
            }}
            maxLength={BOARD_NAME_MAX_LENGTH}
            // After an unknown outcome the name is not sent a second time
            disabled={isCreating || isOutcomeUnknown}
            autoComplete="off"
            autoFocus
            // Only a name that failed the check is invalid; a refusal of the
            // server says nothing about the name
            aria-invalid={problem?.kind === 'invalid-name'}
            aria-describedby={[
              introductionId,
              NAME_HINT_ID,
              problem && NAME_ERROR_ID,
            ]
              .filter(Boolean)
              .join(' ')}
          />
          <p id={NAME_HINT_ID} className="text-muted-foreground text-xs">
            {boardName.length}/{BOARD_NAME_MAX_LENGTH} characters
          </p>
          {problem && (
            <p
              id={NAME_ERROR_ID}
              className="text-destructive text-sm"
              role="alert"
            >
              {problem.message}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {problem?.kind === 'unconfirmed' ? (
            <Button
              type="button"
              ref={recoveryButtonRef}
              onClick={
                problem.recovery === 'reload-page' ? reloadPage : onReloadBoards
              }
            >
              {problem.recovery === 'reload-page'
                ? 'Reload page'
                : 'Reload boards'}
            </Button>
          ) : (
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Board'
              )}
            </Button>
          )}
          {/* After an unknown outcome the list this would go back to may lack
              a board that exists; the button above shows the current one */}
          {onChooseExisting && !isOutcomeUnknown && (
            <Button
              type="button"
              variant="ghost"
              onClick={onChooseExisting}
              disabled={isCreating}
            >
              Choose an existing board
            </Button>
          )}
        </div>
      </form>
    )
  },
)

/**
 * Turns the failure of a creation into what the form shows under the name.
 * Called by the form when {@link CreateDestinationBoardFormProps.createBoardAction}
 * resolved with a failure.
 *
 * @param failure - Why the creation ended without a board to select.
 * @returns
 * - `not-created` when the name can be sent again
 * - `unconfirmed` with the recovery to offer when a board may exist
 * @example
 * toFormProblem({ message: 'Could not confirm ...', nextStep: 'reload-page' })
 * // => { kind: 'unconfirmed', message: 'Could not confirm ...', recovery: 'reload-page' }
 */
function toFormProblem({
  message,
  nextStep,
}: BoardCreationFailure): FormProblem {
  return nextStep === 'try-again'
    ? { kind: 'not-created', message }
    : { kind: 'unconfirmed', message, recovery: nextStep }
}
