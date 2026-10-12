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
   * `false` when a board may exist all the same: the request failed on the
   * way, got no answer in time, or the server could not confirm it. The form
   * then offers to load the boards again instead of a second try, which could
   * make a second board.
   */
  isOutcomeKnown: boolean
}

/**
 * What the form shows under the name field.
 * - `invalid-name`: the name did not pass the check, so nothing was sent
 * - `not-created`: the server answered and no board was created
 * - `unconfirmed`: a board may exist; "Reload boards" takes the place of
 *   "Create Board"
 */
interface FormProblem {
  kind: 'invalid-name' | 'not-created' | 'unconfirmed'
  message: string
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
   * unknown outcome: the list on screen may lack a board that exists.
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
 *       : { message: 'The board was not created. Try again.', isOutcomeKnown: true }
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
    const reloadButtonRef = useRef<HTMLButtonElement>(null)

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
      flushSync(() =>
        setProblem({
          kind: failure.isOutcomeKnown ? 'not-created' : 'unconfirmed',
          message: failure.message,
        }),
      )
      if (failure.isOutcomeKnown) nameFieldRef.current?.focus()
      else reloadButtonRef.current?.focus()
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
          {isOutcomeUnknown ? (
            <Button
              type="button"
              ref={reloadButtonRef}
              onClick={onReloadBoards}
            >
              Reload boards
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
              a board that exists; "Reload boards" shows the current one */}
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
