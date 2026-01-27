'use client'

import { Plus, StickyNote } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PlateEditor } from '@/components/editor/PlateEditor'
import { CreateLinkTypeDialog } from '@/components/Modals/CreateLinkTypeDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  EditableUrlItem,
  type ProjectLink,
} from '@/components/ui/editable-url-item'
import { Label } from '@/components/ui/label'
import { type UserPresetOption } from '@/components/ui/link-type-combobox'
import { getUserPresets, type UserPreset } from '@/lib/actions/user-presets'
import {
  deleteDraftNote,
  selectDraftNote,
  updateDraftNote,
} from '@/lib/redux/slices/draftSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import { getSlateTextLength, parseSlateValue } from '@/lib/utils/slate-utils'
import { isValidUrl } from '@/lib/validations'

/** Maximum character limit for notes */
const NOTE_MAX_LENGTH = 20000
/** Warning threshold for character count display */
const NOTE_WARNING_THRESHOLD = 18000

interface NoteModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback to save note and links to Supabase */
  onSave: (note: string, links: ProjectLink[]) => Promise<void>
  /** Card ID for draft state management */
  cardId: string
  /** Initial note value from Supabase */
  initialNote: string
  /** Initial links value from Supabase */
  initialLinks: ProjectLink[]
  /** Card title for display */
  cardTitle: string
}

/**
 * Note Modal Component
 *
 * A unified modal for editing project notes and links with:
 * - Rich text editor with PlateJS
 * - Links section with 55 built-in presets + user-defined custom presets
 * - Redux draft state persistence (survives browser close)
 * - Optimistic UI feedback with Sonner toast notifications
 *
 * @example
 * <NoteModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSave={async (note, links) => await saveProjectInfo(cardId, note, links)}
 *   cardId="abc-123"
 *   initialNote="Current note content"
 *   initialLinks={[{ type: 'vercel', url: 'https://...' }]}
 *   cardTitle="laststance/gitbox"
 * />
 */
export const NoteModal = memo(function NoteModal({
  isOpen,
  onClose,
  onSave,
  cardId,
  initialNote,
  initialLinks,
  cardTitle,
}: NoteModalProps) {
  const dispatch = useAppDispatch()
  const draft = useAppSelector(selectDraftNote(cardId))

  // Use draft if exists, otherwise initial values
  const [note, setNote] = useState(draft?.content ?? initialNote)
  const [links, setLinks] = useState<ProjectLink[]>(
    draft?.links ?? initialLinks,
  )
  const [isSaving, setIsSaving] = useState(false)

  // Single-edit coordination: only one URL can be edited at a time
  const [editingUrlIndex, setEditingUrlIndex] = useState<number | null>(null)

  // Undo delete support
  const [deletedLink, setDeletedLink] = useState<{
    link: ProjectLink
    index: number
  } | null>(null)

  // User custom presets
  const [userPresets, setUserPresets] = useState<UserPresetOption[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Load user presets on mount
  useEffect(() => {
    let mounted = true
    getUserPresets()
      .then((presets) => {
        if (mounted) {
          setUserPresets(presets)
        }
      })
      .catch(() => {
        // Silently fail - user can still use built-in presets
      })
    return () => {
      mounted = false
    }
  }, [])

  // Sync state when modal opens or initial values change
  useEffect(() => {
    if (isOpen) {
      setNote(draft?.content ?? initialNote)
      setLinks(draft?.links ?? initialLinks)
      setEditingUrlIndex(null)
      setDeletedLink(null)
    }
  }, [isOpen, initialNote, initialLinks, draft?.content, draft?.links])

  /**
   * Calculate text length from the current note (JSON format).
   * Memoized to prevent recalculation on every render.
   */
  const charCount = useMemo(() => {
    try {
      const slateValue = parseSlateValue(note)
      return getSlateTextLength(slateValue)
    } catch {
      return 0
    }
  }, [note])

  /**
   * Handle note change from PlateEditor.
   * Saves to Redux draft state for persistence.
   *
   * @param value - JSON string (Slate format) from PlateEditor
   */
  const handleNoteChange = useCallback(
    (value: string) => {
      // Parse the JSON to get the text length for validation
      try {
        const slateValue = parseSlateValue(value)
        const textLength = getSlateTextLength(slateValue)

        if (textLength <= NOTE_MAX_LENGTH) {
          setNote(value)
          // Save draft to Redux (persisted to LocalStorage)
          dispatch(updateDraftNote({ cardId, content: value, links }))
        }
      } catch {
        // If parsing fails, still allow the change (might be valid JSON in progress)
        setNote(value)
        dispatch(updateDraftNote({ cardId, content: value, links }))
      }
    },
    [cardId, dispatch, links],
  )

  /**
   * Add a new empty URL entry and auto-enter edit mode
   */
  const handleAddUrl = useCallback(() => {
    const newLinks = [...links, { url: '', type: 'vercel' }]
    setLinks(newLinks)
    // Save draft to Redux
    dispatch(updateDraftNote({ cardId, content: note, links: newLinks }))
  }, [cardId, dispatch, links, note])

  /**
   * Handler for when a new custom preset is created
   */
  const handlePresetCreated = useCallback((preset: UserPreset) => {
    setUserPresets((prev) => [...prev, preset])
  }, [])

  /**
   * Handle URL edit start for single-edit coordination
   */
  const handleUrlEditStart = useCallback((index: number) => {
    setEditingUrlIndex(index)
  }, [])

  /**
   * Handle URL change from EditableUrlItem
   */
  const handleUrlChange = useCallback(
    (index: number, url: string) => {
      const newLinks = links.map((link, i) =>
        i === index ? { ...link, url } : link,
      )
      setLinks(newLinks)
      // Save draft to Redux
      dispatch(updateDraftNote({ cardId, content: note, links: newLinks }))
    },
    [cardId, dispatch, links, note],
  )

  /**
   * Handle URL type change from EditableUrlItem
   */
  const handleUrlTypeChange = useCallback(
    (index: number, type: string) => {
      const newLinks = links.map((link, i) =>
        i === index ? { ...link, type } : link,
      )
      setLinks(newLinks)
      // Save draft to Redux
      dispatch(updateDraftNote({ cardId, content: note, links: newLinks }))
    },
    [cardId, dispatch, links, note],
  )

  /**
   * Handle URL removal with undo support
   */
  const handleRemoveUrl = useCallback(
    (index: number) => {
      const linkToDelete = links[index]
      if (!linkToDelete) return
      setDeletedLink({ link: linkToDelete, index })
      const newLinks = links.filter((_, i) => i !== index)
      setLinks(newLinks)
      if (editingUrlIndex === index) {
        setEditingUrlIndex(null)
      }
      // Save draft to Redux
      dispatch(updateDraftNote({ cardId, content: note, links: newLinks }))
    },
    [cardId, dispatch, editingUrlIndex, links, note],
  )

  /**
   * Handle undo delete
   */
  const handleUndoDelete = useCallback(() => {
    if (!deletedLink) return
    const { link, index } = deletedLink
    const newLinks = [...links]
    newLinks.splice(Math.min(index, links.length), 0, link)
    setLinks(newLinks)
    setDeletedLink(null)
    // Save draft to Redux
    dispatch(updateDraftNote({ cardId, content: note, links: newLinks }))
  }, [cardId, deletedLink, dispatch, links, note])

  /**
   * Handle save button click
   * Uses optimistic update for instant feedback
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true)

    // Filter out empty URLs before saving
    const validLinks = links.filter((link) => link.url)

    // Optimistic: close modal and show toast immediately
    onClose()
    toast.success('Project info saved', {
      description: `Note and links for ${cardTitle} have been saved.`,
    })

    try {
      // Save to Supabase in background
      await onSave(note, validLinks)
      // Clear draft on successful save
      dispatch(deleteDraftNote(cardId))
    } catch (error) {
      // Show error toast if save fails
      toast.error('Failed to save project info', {
        description:
          error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }, [note, links, onSave, onClose, cardId, cardTitle, dispatch])

  /**
   * Handle modal close without saving
   * Draft is preserved in Redux for later
   */
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Character count styling based on proximity to limit
  const isNearLimit = charCount >= NOTE_WARNING_THRESHOLD
  const charCountClass = isNearLimit
    ? 'text-sm text-right text-orange-500'
    : 'text-sm text-right text-muted-foreground'

  // Form is valid if all URLs are valid
  const isFormValid = links.every(
    (link) => !link.url || isValidUrl(link.url).valid,
  )

  // Check if there are unsaved changes
  const hasChanges =
    note !== initialNote ||
    JSON.stringify(links) !== JSON.stringify(initialLinks)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-7xl max-h-[90vh] overflow-y-auto"
        data-testid="note-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            Project Note
          </DialogTitle>
          <DialogDescription>
            Add notes and links for {cardTitle}. Your draft is automatically
            saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Note Section */}
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <PlateEditor
              initialValue={note}
              onChange={handleNoteChange}
              placeholder="Type / for commands, or start writing..."
              minHeight="400px"
              maxHeight="400px"
              data-testid="note-editor"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <div>
                {draft && (
                  <p className="text-xs text-muted-foreground">
                    Draft saved{' '}
                    {new Date(draft.lastModified).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <p
                id="note-char-count"
                data-testid="char-count"
                className={charCountClass}
              >
                {charCount.toLocaleString()} /{' '}
                {NOTE_MAX_LENGTH.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Links Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Links</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddUrl}
                data-testid="add-url-button"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add URL
              </Button>
            </div>

            {links.length > 0 && (
              <ul className="space-y-3" data-testid="url-list">
                {links.map((link, index) => (
                  <li key={`${link.type}-${index}`}>
                    <EditableUrlItem
                      link={link}
                      index={index}
                      onUrlChange={(url) => handleUrlChange(index, url)}
                      onTypeChange={(type) => handleUrlTypeChange(index, type)}
                      onDelete={() => handleRemoveUrl(index)}
                      onUndoDelete={handleUndoDelete}
                      userPresets={userPresets}
                      onAddCustomClick={() => setShowCreateDialog(true)}
                      autoEdit={link.url === '' && index === links.length - 1}
                      onEditStart={() => handleUrlEditStart(index)}
                      forceExitEdit={
                        editingUrlIndex !== null && editingUrlIndex !== index
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {hasChanges && !draft && (
              <p className="text-xs text-muted-foreground">
                You have unsaved changes
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              data-testid="cancel-button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !isFormValid}
              data-testid="save-button"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogFooter>

        {/* Create Custom Link Type Dialog */}
        <CreateLinkTypeDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={handlePresetCreated}
        />
      </DialogContent>
    </Dialog>
  )
})
