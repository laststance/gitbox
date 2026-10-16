/**
 * Board Settings Dialog
 *
 * A tabbed dialog for managing board settings including:
 * - General: Rename board functionality
 * - Cards: Card display settings
 * - Danger Zone: Delete board with confirmation
 *
 * Note: Theme is now managed globally via Sidebar ThemeToggle.
 *
 * Uses useActionState for form handling with server-side validation.
 */

'use client'

import { CreditCard, Settings, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  memo,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'

import {
  COMMENT_FONT_SIZES,
  COMMENT_FONT_WEIGHTS,
} from '@/components/Board/CommentDisplay'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  deleteBoardAction,
  renameBoardAction,
  toggleBoardSubtitleVisibility,
  updateBoardSettingsAction,
  updateBoardSubtitle,
  type DeleteBoardState,
  type RenameBoardState,
  type UpdateBoardSettingsState,
} from '@/lib/actions/board'
import { NEAR_LIMIT_COUNTER_TEXT_CLASS } from '@/lib/constants/character-counter'
import {
  type CardDisplaySettings,
  type CommentTextSettings,
  DEFAULT_CARD_DISPLAY_SETTINGS,
  parseBoardSettings,
} from '@/lib/types/board-settings'
import {
  BOARD_NAME_MAX_LENGTH,
  BOARD_SUBTITLE_MAX_LENGTH,
} from '@/lib/validations/board'

/** Tab navigation options */
type SettingsTab = 'general' | 'card-display' | 'danger'

interface BoardSettingsDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog is closed */
  onClose: () => void
  /** Board ID to configure */
  boardId: string
  /** Current board name */
  boardName: string
  /** Current board settings (from board.settings JSON column) */
  boardSettings?: unknown
  /** Current board subtitle text */
  boardSubtitle?: string | null
  /** Callback when subtitle text is saved (for optimistic update) */
  onSubtitleSuccess?: (subtitle: string) => void
  /** Whether subtitle is currently visible in header (default: true) */
  showSubtitle?: boolean
  /** Callback when subtitle visibility changes (for optimistic update) */
  onShowSubtitleChange?: (show: boolean) => void
  /** Callback when rename succeeds (for optimistic update) */
  onRenameSuccess: (newName: string) => void
  /** Callback when card display settings change */
  onCardDisplayChange?: (settings: CardDisplaySettings) => void
  /** Callback when delete succeeds (for navigation) */
  onDeleteSuccess: () => void
}

/** Tab button styles */
const TAB_BASE =
  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-md'
const TAB_ACTIVE = 'bg-primary text-primary-foreground shadow-sm'
const TAB_INACTIVE =
  'text-muted-foreground hover:text-foreground hover:bg-muted'

const initialRenameState: RenameBoardState = {}
const initialSettingsState: UpdateBoardSettingsState = {}
const initialDeleteState: DeleteBoardState = {}

/** Font size display names */
const FONT_SIZE_LABELS: Record<keyof typeof COMMENT_FONT_SIZES, string> = {
  sm: 'Small',
  base: 'Medium',
  lg: 'Large',
}

/** Font weight display names */
const FONT_WEIGHT_LABELS: Record<keyof typeof COMMENT_FONT_WEIGHTS, string> = {
  normal: 'Normal',
  medium: 'Medium',
  semibold: 'Bold',
}

/** CSS class for character counter; turns orange near the limit. */
function charCountClass(count: number, max: number): string {
  return count >= max - 10
    ? `text-sm ${NEAR_LIMIT_COUNTER_TEXT_CLASS}`
    : 'text-muted-foreground text-sm'
}

/**
 * CSS class for a toggle button in the comment-style picker.
 * The border and the tint mark the chosen option; its label keeps the text
 * color. In the theme color the label was below 4.5:1 on that tint in 12 of
 * the 14 themes (2.9:1 on Sunrise).
 * src/tests/unit/styles/selected-repository-badge-contrast.test.ts computes
 * the contrast of the text color on the tint.
 */
function toggleButtonClass(isSelected: boolean): string {
  const base =
    'rounded-md border-2 px-3 py-1.5 text-xs font-medium transition-all'
  return isSelected
    ? `${base} border-primary bg-primary/10 text-foreground`
    : `${base} border-border hover:border-primary/50`
}

/**
 * Board Settings Dialog
 *
 * Displays a tabbed settings interface for board configuration.
 * Includes General (rename), Cards, and Danger Zone (delete) tabs.
 *
 * @example
 * <BoardSettingsDialog
 *   isOpen={isSettingsOpen}
 *   onClose={() => setIsSettingsOpen(false)}
 *   boardId="board-123"
 *   boardName="My Board"
 *   onRenameSuccess={(name) => setBoardName(name)}
 *   onCardDisplayChange={(settings) => updateCardSettings(settings)}
 *   onDeleteSuccess={() => router.push('/boards')}
 * />
 */
export const BoardSettingsDialog = memo(function BoardSettingsDialog({
  isOpen,
  onClose,
  boardId,
  boardName,
  boardSettings,
  boardSubtitle: initialBoardSubtitle = null,
  onSubtitleSuccess,
  showSubtitle: initialShowSubtitle = true,
  onShowSubtitleChange,
  onRenameSuccess,
  onCardDisplayChange,
  onDeleteSuccess,
}: BoardSettingsDialogProps) {
  const router = useRouter()

  // Tab state
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  // Delete confirmation dialog state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  // Rename form state
  const [renameState, renameFormAction, isRenamePending] = useActionState(
    renameBoardAction,
    initialRenameState,
  )
  const [name, setName] = useState(boardName)
  const [lastBoardName, setLastBoardName] = useState(boardName)

  // Sync name from props
  if (boardName !== lastBoardName) {
    setLastBoardName(boardName)
    setName(boardName)
  }

  // Card display settings state
  const [settingsState, settingsFormAction, isSettingsPending] = useActionState(
    updateBoardSettingsAction,
    initialSettingsState,
  )
  const parsedSettings = parseBoardSettings(boardSettings)
  const [cardDisplay, setCardDisplay] = useState<CardDisplaySettings>(
    parsedSettings.cardDisplay ?? DEFAULT_CARD_DISPLAY_SETTINGS,
  )
  const [lastBoardSettings, setLastBoardSettings] = useState(boardSettings)

  // Sync card display from props
  if (boardSettings !== lastBoardSettings) {
    setLastBoardSettings(boardSettings)
    const newParsed = parseBoardSettings(boardSettings)
    setCardDisplay(newParsed.cardDisplay ?? DEFAULT_CARD_DISPLAY_SETTINGS)
  }

  // Subtitle form state
  const [subtitle, setSubtitle] = useState(initialBoardSubtitle ?? '')
  const [lastBoardSubtitle, setLastBoardSubtitle] =
    useState(initialBoardSubtitle)
  const [isSavingSubtitle, setIsSavingSubtitle] = useState(false)

  // Sync subtitle from props
  if (initialBoardSubtitle !== lastBoardSubtitle) {
    setLastBoardSubtitle(initialBoardSubtitle)
    setSubtitle(initialBoardSubtitle ?? '')
  }

  // Subtitle visibility state
  const [subtitleVisible, setSubtitleVisible] = useState(initialShowSubtitle)
  const [lastShowSubtitle, setLastShowSubtitle] = useState(initialShowSubtitle)
  const [isTogglingSubtitle, setIsTogglingSubtitle] = useState(false)

  // Sync subtitle visibility from props
  if (initialShowSubtitle !== lastShowSubtitle) {
    setLastShowSubtitle(initialShowSubtitle)
    setSubtitleVisible(initialShowSubtitle)
  }

  /**
   * Save subtitle text via server action
   */
  async function handleSaveSubtitle(): Promise<void> {
    setIsSavingSubtitle(true)
    try {
      const result = await updateBoardSubtitle(boardId, subtitle)
      if (result.success) {
        onSubtitleSuccess?.(result.data.subtitle)
        toast.success('Subtitle updated')
      } else {
        toast.error('Failed to update subtitle', {
          description: result.error,
        })
      }
    } finally {
      setIsSavingSubtitle(false)
    }
  }

  /**
   * Toggle subtitle visibility via server action
   */
  async function handleToggleSubtitleVisibility(
    checked: boolean,
  ): Promise<void> {
    setIsTogglingSubtitle(true)
    try {
      const result = await toggleBoardSubtitleVisibility(boardId, checked)
      if (result.success) {
        setSubtitleVisible(result.data.showSubtitle)
        onShowSubtitleChange?.(result.data.showSubtitle)
        toast.success(
          checked ? 'Subtitle is now visible' : 'Subtitle is now hidden',
        )
      } else {
        toast.error('Failed to update visibility', {
          description: result.error,
        })
      }
    } finally {
      setIsTogglingSubtitle(false)
    }
  }

  // Delete form state
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(
    deleteBoardAction,
    initialDeleteState,
  )

  // ========================================
  // Callback refs for effect stability
  // These refs store the latest callbacks to avoid including them in effect deps
  // This prevents infinite loops when parent re-renders with new callback refs
  // ========================================
  const onRenameSuccessRef = useRef(onRenameSuccess)
  const onCardDisplayChangeRef = useRef(onCardDisplayChange)
  const onDeleteSuccessRef = useRef(onDeleteSuccess)
  const onCloseRef = useRef(onClose)

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onRenameSuccessRef.current = onRenameSuccess
    onCardDisplayChangeRef.current = onCardDisplayChange
    onDeleteSuccessRef.current = onDeleteSuccess
    onCloseRef.current = onClose
  })

  // Handle rename success
  // Uses ref to avoid callback in deps (prevents infinite loops)
  useEffect(() => {
    if (renameState.success && renameState.newName) {
      toast.success('Board renamed', {
        description: `Board renamed to "${renameState.newName}".`,
      })
      onRenameSuccessRef.current(renameState.newName)
    }
  }, [renameState.success, renameState.newName])

  // Handle card display settings success
  // Uses ref to avoid callback in deps (prevents infinite loops)
  // Note: cardDisplay is also removed from deps since we use the current state via ref
  useEffect(() => {
    if (settingsState.success) {
      toast.success('Card display settings updated')
      onCardDisplayChangeRef.current?.(cardDisplay)
      onCloseRef.current() // Close modal after successful save
    } else if (settingsState.error) {
      toast.error('Failed to update settings', {
        description: settingsState.error,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cardDisplay accessed via closure is intentional
  }, [settingsState.success, settingsState.error])

  // Handle delete success - navigate away
  // Uses refs to avoid callbacks in deps (prevents infinite loops)
  // FIX for GITBOX-E: Callbacks in deps caused infinite loop when parent re-rendered
  useEffect(() => {
    if (deleteState.success) {
      toast.success('Board deleted', {
        description: `"${boardName}" has been deleted.`,
      })
      onDeleteSuccessRef.current()
      onCloseRef.current()
      router.push('/boards')
    } else if (deleteState.error) {
      toast.error('Failed to delete board', {
        description: deleteState.error,
      })
    }
  }, [deleteState.success, deleteState.error, boardName, router])

  // Derive delete confirm dialog state from deleteState
  // When deletion succeeds, we navigate away so the dialog closes naturally
  // This avoids calling setState in an effect
  const shouldShowDeleteConfirm = isDeleteConfirmOpen && !deleteState.success

  /**
   * Update card display visibility toggle
   *
   * @param key - Setting key to update
   * @param value - New boolean value
   */
  function handleVisibilityChange(
    key: 'showGitHubDescription' | 'showComment',
    value: boolean,
  ): void {
    setCardDisplay((prev) => ({ ...prev, [key]: value }))
  }

  /**
   * Update comment text setting
   *
   * @param key - Text setting key (fontSize or fontWeight)
   * @param value - New setting value
   */
  function handleTextChange<K extends keyof CommentTextSettings>(
    key: K,
    value: CommentTextSettings[K],
  ): void {
    setCardDisplay((prev) => ({
      ...prev,
      commentText: { ...prev.commentText, [key]: value },
    }))
  }

  /**
   * Reset tab state when dialog closes
   * Uses ref to ensure stable callback (prevents unnecessary re-renders)
   */
  const handleClose = useCallback(() => {
    setActiveTab('general')
    onCloseRef.current()
  }, [])

  const charCount = name.length
  const hasRenameError =
    renameState.errors?.name && renameState.errors.name.length > 0

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-140">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Board Settings
            </DialogTitle>
            <DialogDescription>
              Configure settings for &quot;{boardName}&quot;
            </DialogDescription>
          </DialogHeader>

          {/* Tab Navigation. In one row the tabs are wider than a phone,
              so they take a second row there (at 375px Danger Zone stands
              alone in it): a row that does not wrap made the whole dialog
              scroll sideways. Each tab has the id its panel is labelled by. */}
          <nav
            className="border-border flex flex-wrap gap-1 border-b pb-2"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              id="tab-general"
              aria-selected={activeTab === 'general'}
              aria-controls="panel-general"
              onClick={() => setActiveTab('general')}
              className={`${TAB_BASE} ${activeTab === 'general' ? TAB_ACTIVE : TAB_INACTIVE}`}
            >
              <Settings className="h-4 w-4" />
              General
            </button>
            <button
              type="button"
              role="tab"
              id="tab-card-display"
              aria-selected={activeTab === 'card-display'}
              aria-controls="panel-card-display"
              onClick={() => setActiveTab('card-display')}
              className={`${TAB_BASE} ${activeTab === 'card-display' ? TAB_ACTIVE : TAB_INACTIVE}`}
              data-testid="tab-card-display"
            >
              <CreditCard className="h-4 w-4" />
              Cards
            </button>
            <button
              type="button"
              role="tab"
              id="tab-danger"
              aria-selected={activeTab === 'danger'}
              aria-controls="panel-danger"
              onClick={() => setActiveTab('danger')}
              className={`${TAB_BASE} ${activeTab === 'danger' ? TAB_ACTIVE : TAB_INACTIVE} ${activeTab === 'danger' ? '' : 'hover:text-destructive'}`}
            >
              <Trash2 className="h-4 w-4" />
              Danger Zone
            </button>
          </nav>

          {/* Tab Panels */}
          <div className="min-h-70 py-4">
            {/* General Tab: Rename */}
            {activeTab === 'general' && (
              <div
                id="panel-general"
                role="tabpanel"
                aria-labelledby="tab-general"
              >
                <h3 className="mb-4 text-lg font-semibold">Rename Board</h3>
                <form action={renameFormAction} className="space-y-4">
                  <input type="hidden" name="boardId" value={boardId} />

                  <div className="space-y-2">
                    <Input
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Board name"
                      maxLength={BOARD_NAME_MAX_LENGTH}
                      aria-invalid={hasRenameError}
                      aria-describedby={
                        hasRenameError ? 'name-error' : 'name-char-count'
                      }
                      autoFocus
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      data-form-type="other"
                    />

                    <div className="flex items-center justify-between">
                      {hasRenameError ? (
                        <p
                          id="name-error"
                          className="text-destructive text-sm"
                          role="alert"
                        >
                          {renameState.errors?.name?.[0]}
                        </p>
                      ) : (
                        <span />
                      )}
                      <p
                        id="name-char-count"
                        className={charCountClass(
                          charCount,
                          BOARD_NAME_MAX_LENGTH,
                        )}
                      >
                        {charCount}/{BOARD_NAME_MAX_LENGTH}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isRenamePending || name.trim() === ''}
                    aria-label={`Rename board to ${name}`}
                  >
                    {isRenamePending ? 'Renaming...' : 'Rename'}
                  </Button>
                </form>

                {/* Subtitle Edit Section */}
                <div className="mt-8">
                  <h3 className="mb-4 text-lg font-semibold">Board Subtitle</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="Add a subtitle..."
                        maxLength={BOARD_SUBTITLE_MAX_LENGTH}
                        aria-describedby="subtitle-char-count"
                        autoComplete="off"
                        data-1p-ignore
                        data-lpignore="true"
                        data-form-type="other"
                        data-testid="subtitle-input"
                      />
                      <div className="flex items-center justify-between">
                        <span />
                        <p
                          id="subtitle-char-count"
                          className={charCountClass(
                            subtitle.length,
                            BOARD_SUBTITLE_MAX_LENGTH,
                          )}
                        >
                          {subtitle.length}/{BOARD_SUBTITLE_MAX_LENGTH}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      disabled={isSavingSubtitle}
                      onClick={handleSaveSubtitle}
                      data-testid="save-subtitle"
                    >
                      {isSavingSubtitle ? 'Saving...' : 'Save Subtitle'}
                    </Button>
                  </div>
                </div>

                {/* Subtitle Visibility Toggle */}
                <div className="mt-6">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="show-subtitle"
                        className="text-sm font-medium"
                      >
                        Show Subtitle
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Display subtitle below board name in the header
                      </p>
                    </div>
                    <Switch
                      id="show-subtitle"
                      checked={subtitleVisible}
                      onCheckedChange={handleToggleSubtitleVisibility}
                      disabled={isTogglingSubtitle}
                      data-testid="toggle-show-subtitle"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Card Display Tab: Visibility & Style Settings */}
            {activeTab === 'card-display' && (
              <div
                id="panel-card-display"
                role="tabpanel"
                aria-labelledby="tab-card-display"
                className="space-y-6"
                data-testid="panel-card-display"
              >
                <div>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Customize how cards appear on this board. Control which
                    elements are visible and how comments are styled.
                  </p>
                </div>

                {/* Visibility Toggles */}
                <div className="space-y-4">
                  {/* h3 under the dialog's h2, as in the other panels: the
                      size comes from the class, not from the level */}
                  <h3 className="text-sm font-semibold">Card Visibility</h3>

                  {/* Show GitHub Description */}
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="show-description"
                        className="text-sm font-medium"
                      >
                        GitHub Description
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Display repository description on cards
                      </p>
                    </div>
                    <Switch
                      id="show-description"
                      checked={cardDisplay.showGitHubDescription}
                      onCheckedChange={(checked: boolean) =>
                        handleVisibilityChange('showGitHubDescription', checked)
                      }
                      data-testid="toggle-github-description"
                    />
                  </div>

                  {/* Show Comment */}
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="show-comment"
                        className="text-sm font-medium"
                      >
                        Inline Comment
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Display comment section on cards
                      </p>
                    </div>
                    <Switch
                      id="show-comment"
                      checked={cardDisplay.showComment}
                      onCheckedChange={(checked: boolean) =>
                        handleVisibilityChange('showComment', checked)
                      }
                      data-testid="toggle-comment"
                    />
                  </div>
                </div>

                {/* Comment Text Options (only show when comments are enabled) */}
                {cardDisplay.showComment && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Comment Text</h3>

                    {/* Font Size */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        Font Size
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {(
                          Object.keys(
                            COMMENT_FONT_SIZES,
                          ) as (keyof typeof COMMENT_FONT_SIZES)[]
                        ).map((size) => {
                          const isSelected =
                            cardDisplay.commentText.fontSize === size
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => handleTextChange('fontSize', size)}
                              className={toggleButtonClass(isSelected)}
                              aria-pressed={isSelected}
                              data-testid={`font-size-${size}`}
                            >
                              {FONT_SIZE_LABELS[size]}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Font Weight */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        Font Weight
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {(
                          Object.keys(
                            COMMENT_FONT_WEIGHTS,
                          ) as (keyof typeof COMMENT_FONT_WEIGHTS)[]
                        ).map((weight) => {
                          const isSelected =
                            cardDisplay.commentText.fontWeight === weight
                          return (
                            <button
                              key={weight}
                              type="button"
                              onClick={() =>
                                handleTextChange('fontWeight', weight)
                              }
                              className={toggleButtonClass(isSelected)}
                              aria-pressed={isSelected}
                              data-testid={`font-weight-${weight}`}
                            >
                              {FONT_WEIGHT_LABELS[weight]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Settings Form */}
                <form action={settingsFormAction} className="pt-2">
                  <input type="hidden" name="boardId" value={boardId} />
                  <input
                    type="hidden"
                    name="settings"
                    value={JSON.stringify({ cardDisplay })}
                  />
                  <Button
                    type="submit"
                    disabled={isSettingsPending}
                    data-testid="save-card-display-settings"
                  >
                    {isSettingsPending ? 'Saving...' : 'Save Settings'}
                  </Button>
                </form>
              </div>
            )}

            {/* Danger Zone Tab: Delete */}
            {activeTab === 'danger' && (
              <div
                id="panel-danger"
                role="tabpanel"
                aria-labelledby="tab-danger"
                className="space-y-4"
              >
                <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4">
                  <h3 className="text-destructive mb-2 text-lg font-semibold">
                    Delete Board
                  </h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Once you delete this board, there is no going back. All
                    columns and cards will be permanently removed. The notes,
                    links and comments of its repositories are kept for when you
                    add them again.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Board
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isRenamePending || isSettingsPending || isDeletePending}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={shouldShowDeleteConfirm}
        onOpenChange={setIsDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Board</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{boardName}&quot;? This
              action cannot be undone. All columns and cards will be permanently
              removed. The notes, links and comments of its repositories are
              kept for when you add them again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>
              Cancel
            </AlertDialogCancel>
            <form action={deleteFormAction}>
              <input type="hidden" name="boardId" value={boardId} />
              <Button
                type="submit"
                variant="destructive"
                disabled={isDeletePending}
                aria-label={`Delete board ${boardName}`}
              >
                {isDeletePending ? 'Deleting...' : 'Delete Board'}
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})
