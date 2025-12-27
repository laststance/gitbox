/**
 * Board Settings Dialog
 *
 * A tabbed dialog for managing board settings including:
 * - General: Rename board functionality
 * - Theme: Board-specific theme picker (overrides app theme)
 * - Danger Zone: Delete board with confirmation
 *
 * Uses useActionState for form handling with server-side validation.
 */

'use client'

import { Check, Moon, Palette, Settings, Sun, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { memo, useActionState, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

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
import {
  deleteBoardAction,
  renameBoardAction,
  updateBoardThemeAction,
  type DeleteBoardState,
  type RenameBoardState,
  type UpdateBoardThemeState,
} from '@/lib/actions/board'
import type { ThemeType } from '@/lib/hooks/use-theme'
import { DARK_THEMES, LIGHT_THEMES } from '@/lib/hooks/use-theme'
import { applyTheme } from '@/lib/theme'
import { BOARD_NAME_MAX_LENGTH } from '@/lib/validations/board'

/** Tab navigation options */
type SettingsTab = 'general' | 'theme' | 'danger'

interface BoardSettingsDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog is closed */
  onClose: () => void
  /** Board ID to configure */
  boardId: string
  /** Current board name */
  boardName: string
  /** Current board theme (null for app default) */
  currentTheme?: string | null
  /** Callback when rename succeeds (for optimistic update) */
  onRenameSuccess: (newName: string) => void
  /** Callback when theme changes (for optimistic update) */
  onThemeChange: (newTheme: string) => void
  /** Callback when delete succeeds (for navigation) */
  onDeleteSuccess: () => void
}

/** Board theme type (excludes 'system' which is app-level only) */
type BoardThemeType = Exclude<ThemeType, 'system'>

/** Theme metadata for display */
const THEME_INFO: Record<
  BoardThemeType,
  { name: string; color: string; description: string }
> = {
  sunrise: { name: 'Sunrise', color: '#f59e0b', description: 'Warm amber' },
  sandstone: {
    name: 'Sandstone',
    color: '#a8a29e',
    description: 'Earthy neutral',
  },
  mint: { name: 'Mint', color: '#10b981', description: 'Fresh green' },
  sky: { name: 'Sky', color: '#0ea5e9', description: 'Calm blue' },
  lavender: { name: 'Lavender', color: '#a78bfa', description: 'Soft purple' },
  rose: { name: 'Rose', color: '#f43f5e', description: 'Vibrant pink' },
  midnight: { name: 'Midnight', color: '#1e40af', description: 'Deep blue' },
  graphite: { name: 'Graphite', color: '#374151', description: 'Dark gray' },
  forest: { name: 'Forest', color: '#166534', description: 'Dark green' },
  ocean: { name: 'Ocean', color: '#0c4a6e', description: 'Deep teal' },
  plum: { name: 'Plum', color: '#7e22ce', description: 'Rich purple' },
  rust: { name: 'Rust', color: '#9a3412', description: 'Dark orange' },
}

/** Tab button styles */
const TAB_BASE =
  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-md'
const TAB_ACTIVE = 'bg-primary text-primary-foreground shadow-sm'
const TAB_INACTIVE =
  'text-muted-foreground hover:text-foreground hover:bg-muted'

/** Theme button styles */
const THEME_BUTTON_BASE =
  'relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all'
const THEME_BUTTON_SELECTED =
  'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2'
const THEME_BUTTON_UNSELECTED =
  'border-border hover:border-primary/50 hover:bg-muted/50'

const initialRenameState: RenameBoardState = {}
const initialThemeState: UpdateBoardThemeState = {}
const initialDeleteState: DeleteBoardState = {}

/**
 * Board Settings Dialog
 *
 * Displays a tabbed settings interface for board configuration.
 * Includes General (rename), Theme (picker), and Danger Zone (delete) tabs.
 *
 * @example
 * <BoardSettingsDialog
 *   isOpen={isSettingsOpen}
 *   onClose={() => setIsSettingsOpen(false)}
 *   boardId="board-123"
 *   boardName="My Board"
 *   currentTheme="sunrise"
 *   onRenameSuccess={(name) => setBoardName(name)}
 *   onThemeChange={(theme) => applyBoardTheme(theme)}
 *   onDeleteSuccess={() => router.push('/boards')}
 * />
 */
export const BoardSettingsDialog = memo(function BoardSettingsDialog({
  isOpen,
  onClose,
  boardId,
  boardName,
  currentTheme,
  onRenameSuccess,
  onThemeChange,
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

  // Theme form state
  const [themeState, themeFormAction, isThemePending] = useActionState(
    updateBoardThemeAction,
    initialThemeState,
  )
  const [selectedTheme, setSelectedTheme] = useState<string>(
    currentTheme || 'sunrise',
  )
  const [lastCurrentTheme, setLastCurrentTheme] = useState(currentTheme)

  // Sync theme from props
  if (currentTheme !== lastCurrentTheme) {
    setLastCurrentTheme(currentTheme)
    setSelectedTheme(currentTheme || 'sunrise')
  }

  // Delete form state
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(
    deleteBoardAction,
    initialDeleteState,
  )

  // Handle rename success
  useEffect(() => {
    if (renameState.success && renameState.newName) {
      toast.success('Board renamed', {
        description: `Board renamed to "${renameState.newName}".`,
      })
      onRenameSuccess(renameState.newName)
    }
  }, [renameState.success, renameState.newName, onRenameSuccess])

  // Handle theme success
  useEffect(() => {
    if (themeState.success && themeState.newTheme) {
      toast.success('Theme updated', {
        description: `Board theme set to ${THEME_INFO[themeState.newTheme as keyof typeof THEME_INFO]?.name || themeState.newTheme}.`,
      })
      onThemeChange(themeState.newTheme)
    } else if (themeState.error) {
      toast.error('Failed to update theme', {
        description: themeState.error,
      })
    }
  }, [themeState.success, themeState.newTheme, themeState.error, onThemeChange])

  // Handle delete success - navigate away
  useEffect(() => {
    if (deleteState.success) {
      toast.success('Board deleted', {
        description: `"${boardName}" has been deleted.`,
      })
      onDeleteSuccess()
      onClose()
      router.push('/boards')
    } else if (deleteState.error) {
      toast.error('Failed to delete board', {
        description: deleteState.error,
      })
    }
  }, [
    deleteState.success,
    deleteState.error,
    boardName,
    onDeleteSuccess,
    onClose,
    router,
  ])

  // Derive delete confirm dialog state from deleteState
  // When deletion succeeds, we navigate away so the dialog closes naturally
  // This avoids calling setState in an effect
  const shouldShowDeleteConfirm = isDeleteConfirmOpen && !deleteState.success

  /**
   * Apply theme preview immediately on selection
   * Persists to server via form submission
   *
   * @param theme - Theme name to select and preview
   */
  function handleThemeSelect(theme: string): void {
    setSelectedTheme(theme)
    // Apply theme immediately for visual feedback
    applyTheme(theme as BoardThemeType)
  }

  /**
   * Reset tab state when dialog closes
   */
  const handleClose = useCallback(() => {
    setActiveTab('general')
    onClose()
  }, [onClose])

  const charCount = name.length
  const isNearLimit = charCount >= BOARD_NAME_MAX_LENGTH - 10
  const hasRenameError =
    renameState.errors?.name && renameState.errors.name.length > 0

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent
          className="sm:max-w-[560px]"
          accessibleTitle="Board Settings"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Board Settings
            </DialogTitle>
            <DialogDescription>
              Configure settings for &quot;{boardName}&quot;
            </DialogDescription>
          </DialogHeader>

          {/* Tab Navigation */}
          <nav
            className="flex gap-1 border-b border-border pb-2"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
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
              aria-selected={activeTab === 'theme'}
              aria-controls="panel-theme"
              onClick={() => setActiveTab('theme')}
              className={`${TAB_BASE} ${activeTab === 'theme' ? TAB_ACTIVE : TAB_INACTIVE}`}
            >
              <Palette className="h-4 w-4" />
              Theme
            </button>
            <button
              type="button"
              role="tab"
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
          <div className="min-h-[280px] py-4">
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
                          className="text-sm text-destructive"
                          role="alert"
                        >
                          {renameState.errors?.name?.[0]}
                        </p>
                      ) : (
                        <span />
                      )}
                      <p
                        id="name-char-count"
                        className={
                          isNearLimit
                            ? 'text-sm text-orange-500'
                            : 'text-sm text-muted-foreground'
                        }
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
              </div>
            )}

            {/* Theme Tab: Theme Picker */}
            {activeTab === 'theme' && (
              <div
                id="panel-theme"
                role="tabpanel"
                aria-labelledby="tab-theme"
                className="space-y-5"
              >
                <div>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Select a theme for this board. The board theme overrides
                    your app theme when viewing this board.
                  </p>
                </div>

                {/* Light Themes */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Sun className="h-4 w-4" />
                    Light Themes
                  </h4>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {(LIGHT_THEMES as BoardThemeType[]).map((theme) => {
                      const info = THEME_INFO[theme]
                      const isSelected = selectedTheme === theme
                      return (
                        <button
                          key={theme}
                          type="button"
                          onClick={() => handleThemeSelect(theme)}
                          className={`${THEME_BUTTON_BASE} ${isSelected ? THEME_BUTTON_SELECTED : THEME_BUTTON_UNSELECTED}`}
                          aria-label={`Select ${info.name} theme`}
                          aria-pressed={isSelected}
                        >
                          <div
                            className="h-8 w-8 rounded-full shadow-sm"
                            style={{ backgroundColor: info.color }}
                          />
                          <span className="text-xs font-medium">
                            {info.name}
                          </span>
                          {isSelected && (
                            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Dark Themes */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Moon className="h-4 w-4" />
                    Dark Themes
                  </h4>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {(DARK_THEMES as BoardThemeType[]).map((theme) => {
                      const info = THEME_INFO[theme]
                      const isSelected = selectedTheme === theme
                      return (
                        <button
                          key={theme}
                          type="button"
                          onClick={() => handleThemeSelect(theme)}
                          className={`${THEME_BUTTON_BASE} ${isSelected ? THEME_BUTTON_SELECTED : THEME_BUTTON_UNSELECTED}`}
                          aria-label={`Select ${info.name} theme`}
                          aria-pressed={isSelected}
                        >
                          <div
                            className="h-8 w-8 rounded-full shadow-sm"
                            style={{ backgroundColor: info.color }}
                          />
                          <span className="text-xs font-medium">
                            {info.name}
                          </span>
                          {isSelected && (
                            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Save Theme Form */}
                <form action={themeFormAction} className="pt-2">
                  <input type="hidden" name="boardId" value={boardId} />
                  <input type="hidden" name="theme" value={selectedTheme} />
                  <Button
                    type="submit"
                    disabled={isThemePending || selectedTheme === currentTheme}
                  >
                    {isThemePending ? 'Saving...' : 'Save Theme'}
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
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h3 className="mb-2 text-lg font-semibold text-destructive">
                    Delete Board
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Once you delete this board, there is no going back. All
                    columns and cards will be permanently removed.
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
              disabled={isRenamePending || isThemePending || isDeletePending}
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
              removed.
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

export default BoardSettingsDialog
