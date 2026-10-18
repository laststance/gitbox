/**
 * Create Destination Board Form
 *
 * The form inside {@link MoveToAnotherBoardDialog} that makes a new board to
 * move a card to: one field for the name and a "Create Board" button. It is
 * shown when the user has no other board, and when they press "New Board…"
 * although they have some.
 */

'use client'

import { LayoutGrid, Loader2 } from 'lucide-react'
import { memo, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { match } from 'ts-pattern'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OUTCOME_UNKNOWN_TEXT_CLASS } from '@/lib/constants/outcome-unknown'
import { reloadPage } from '@/lib/utils/reload-page'
import type { BoardCreationAttempt } from '@/lib/utils/request-board-creation'
import { BOARD_NAME_MAX_LENGTH, boardNameSchema } from '@/lib/validations/board'

/** Id of the name field; its label, hint and error text point to it. */
const NAME_FIELD_ID = 'destination-board-name'
const NAME_HINT_ID = `${NAME_FIELD_ID}-hint`
const NAME_ERROR_ID = `${NAME_FIELD_ID}-error`

/** A creation that gave the form no board to select. */
type CreationRefusal = Exclude<BoardCreationAttempt, { status: 'created' }>

/**
 * What the form shows under the name field.
 * - `invalid-name`: the name did not pass the check, so nothing was sent
 * - a {@link CreationRefusal}: the creation ended as {@link requestBoardCreation} said
 */
type FormProblem = { status: 'invalid-name'; message: string } | CreationRefusal

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
   * with the creation as it ended, so the form chooses the button from that
   * status. `isCreating` is `false` on screen by the time it resolves, so the
   * form can take the focus back.
   */
  createBoardAction: (boardName: string) => Promise<CreationRefusal | null>
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
 *       : { status: 'not-created', message: 'The board was not created. Try again.' }
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

    const recovery = problem === null ? 'create' : creationRecovery(problem)
    // A second try could make a second board, or this page can no longer send one
    const isFormClosed = recovery !== 'create'

    const handleSubmit = async (
      event: FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault()
      setProblem(null)

      // Same schema as the server: an empty or too long name needs no request
      const nameValidation = boardNameSchema.safeParse(boardName)
      if (!nameValidation.success) {
        setProblem({
          status: 'invalid-name',
          message:
            nameValidation.error.issues[0]?.message || 'Invalid board name',
        })
        nameFieldRef.current?.focus()
        return
      }

      const refusal = await createBoardAction(nameValidation.data)
      if (!refusal) return

      // flushSync: the control that takes the focus exists and is enabled
      // once this returns. The field lost the focus when it was disabled for
      // the request.
      flushSync(() => setProblem(refusal))
      if (creationRecovery(refusal) === 'create') nameFieldRef.current?.focus()
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
            // After an unknown outcome, or a page that is out of date, the
            // name is not sent a second time
            disabled={isCreating || isFormClosed}
            autoComplete="off"
            autoFocus
            // Only a name that failed the check is invalid; a refusal of the
            // server says nothing about the name
            aria-invalid={problem?.status === 'invalid-name'}
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
              className={`${
                problem.status === 'unconfirmed'
                  ? OUTCOME_UNKNOWN_TEXT_CLASS
                  : 'text-destructive'
              } text-sm`}
              role="alert"
            >
              {problem.message}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {recovery === 'create' ? (
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Board'
              )}
            </Button>
          ) : (
            <Button
              type="button"
              ref={recoveryButtonRef}
              // It takes the focus: read with it, the message says why it
              // stands where "Create Board" stood
              aria-describedby={NAME_ERROR_ID}
              onClick={recovery === 'reload-page' ? reloadPage : onReloadBoards}
            >
              {recovery === 'reload-page' ? 'Reload page' : 'Reload boards'}
            </Button>
          )}
          {/* After an unknown outcome the list this would go back to may lack
              a board that exists; the button above shows the current one */}
          {onChooseExisting && !isFormClosed && (
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
 * Chooses the button under the name field from the problem shown there.
 *
 * The creation arrives as {@link requestBoardCreation} ended it, and the form
 * reads that status itself, as {@link CreateBoardForm} does: a refusal leaves
 * "Create Board", a creation that may have happened offers "Reload boards"
 * once the request has ended and "Reload page" while it is still running,
 * and a page whose build no longer has the action offers "Reload page".
 * Called by {@link CreateDestinationBoardForm} when it renders the button and
 * when it puts the focus back after the request.
 *
 * @param problem - The name that failed the check, or the creation that gave no board.
 * @returns
 * - `create`: "Create Board" stays and the name can be sent again
 * - `reload-boards`: "Reload boards" takes its place
 * - `reload-page`: "Reload page" takes its place
 * @example
 * creationRecovery({ status: 'unconfirmed', message: 'Could not confirm ...', isRequestStillRunning: true })
 * // => 'reload-page'
 */
function creationRecovery(
  problem: FormProblem,
): 'create' | 'reload-boards' | 'reload-page' {
  return match(problem)
    .returnType<'create' | 'reload-boards' | 'reload-page'>()
    .with({ status: 'invalid-name' }, () => 'create')
    .with({ status: 'not-created' }, () => 'create')
    .with(
      { status: 'unconfirmed', isRequestStillRunning: true },
      () => 'reload-page',
    )
    .with({ status: 'unconfirmed' }, () => 'reload-boards')
    .with({ status: 'out-of-date' }, () => 'reload-page')
    .exhaustive()
}
