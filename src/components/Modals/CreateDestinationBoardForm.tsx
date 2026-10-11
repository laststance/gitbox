/**
 * Create Destination Board Form
 *
 * The form inside {@link MoveToAnotherBoardDialog} that makes a new board to
 * move a card to: one field for the name and a "Create board" button. It is
 * shown when the user has no other board, and when they press "New board…"
 * although they have some.
 */

'use client'

import { LayoutGrid, Loader2 } from 'lucide-react'
import { memo, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BOARD_NAME_MAX_LENGTH, boardNameSchema } from '@/lib/validations/board'

/** Id of the name field; its label and its error text point to it. */
const NAME_FIELD_ID = 'destination-board-name'
const NAME_ERROR_ID = `${NAME_FIELD_ID}-error`

interface CreateDestinationBoardFormProps {
  /**
   * `true` while the board is being created. The dialog owns this flag
   * because it also keeps itself open for that time; here it disables the
   * field and both buttons.
   */
  isCreating: boolean
  /**
   * Creates a board from the typed name. Resolves with the text to show
   * under the field when no board was created, or with `null` when it was.
   */
  createBoardAction: (boardName: string) => Promise<string | null>
  /**
   * Goes back to the list of existing boards. Left out when the user has no
   * other board, so there is nothing to go back to.
   */
  onChooseExisting?: () => void
}

/**
 * Name field and "Create board" button for a board made inside the move
 * dialog. Keeps what the user typed when the creation fails and shows the
 * reason under the field.
 *
 * The field suggests no name: a default such as "Archive" would make one
 * kind of board look special, and a board is a board.
 *
 * @param isCreating - Disables the form while the board is being created.
 * @param createBoardAction - Creates the board; resolves with the failure text or `null`.
 * @param onChooseExisting - Shows "Choose an existing board" when given.
 * @example
 * <CreateDestinationBoardForm
 *   isCreating={false}
 *   createBoardAction={async (boardName) => (await createBoard(boardName, 'single-column')).success ? null : 'The board was not created. Try again.'}
 *   onChooseExisting={() => setIsCreateFormRequested(false)}
 * />
 */
export const CreateDestinationBoardForm = memo(
  function CreateDestinationBoardForm({
    isCreating,
    createBoardAction,
    onChooseExisting,
  }: CreateDestinationBoardFormProps) {
    const [boardName, setBoardName] = useState('')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const handleSubmit = async (
      event: FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault()
      setErrorMessage(null)

      // Same schema as the server: an empty or too long name needs no request
      const nameValidation = boardNameSchema.safeParse(boardName)
      if (!nameValidation.success) {
        setErrorMessage(
          nameValidation.error.issues[0]?.message || 'Invalid board name',
        )
        return
      }

      // After a creation the dialog shows the board list again and this form
      // is gone, so only a failure comes back to it
      const failureMessage = await createBoardAction(nameValidation.data)
      if (failureMessage) setErrorMessage(failureMessage)
    }

    return (
      <form onSubmit={handleSubmit} noValidate className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor={NAME_FIELD_ID} className="flex items-center gap-2">
            <LayoutGrid className="text-muted-foreground h-4 w-4" />
            Board name
          </Label>
          <Input
            id={NAME_FIELD_ID}
            value={boardName}
            onChange={(event) => {
              setBoardName(event.target.value)
              // The message was about the name as it was before this edit
              setErrorMessage(null)
            }}
            maxLength={BOARD_NAME_MAX_LENGTH}
            disabled={isCreating}
            autoComplete="off"
            autoFocus
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? NAME_ERROR_ID : undefined}
          />
          {errorMessage && (
            <p
              id={NAME_ERROR_ID}
              className="text-destructive text-sm"
              role="alert"
            >
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create board'
            )}
          </Button>
          {onChooseExisting && (
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
