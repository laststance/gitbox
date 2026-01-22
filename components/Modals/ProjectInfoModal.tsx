'use client'

import { Plus } from 'lucide-react'
import { useState, useEffect, useCallback, memo, useMemo } from 'react'

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
import { getSlateTextLength, parseSlateValue } from '@/lib/utils/slate-utils'
import { isValidUrl } from '@/lib/validations'

/** Base styles for character count */
const CHAR_COUNT_BASE = 'text-sm text-right'
const CHAR_COUNT_WARNING = 'text-warning'
const CHAR_COUNT_NORMAL = 'text-muted-foreground'

export interface ProjectInfo {
  id: string
  note: string
  comment: string
  links: ProjectLink[]
}

interface ProjectInfoModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    note: string
    comment: string
    links: ProjectLink[]
  }) => void
  projectInfo: ProjectInfo
}

const NOTE_MAX_LENGTH = 20000
const NOTE_WARNING_THRESHOLD = 18000

/**
 * Internal form component that initializes state from props.
 * Using a separate component with key={projectInfo.id} ensures state resets
 * when projectInfo changes, avoiding useEffect setState patterns.
 */
interface ProjectInfoFormProps {
  projectInfo: ProjectInfo
  onSave: ProjectInfoModalProps['onSave']
  onClose: () => void
}

const ProjectInfoForm = memo(function ProjectInfoForm({
  projectInfo,
  onSave,
  onClose,
}: ProjectInfoFormProps) {
  // State initialized from props - will reset when component remounts via key
  const [note, setNote] = useState(projectInfo.note)
  // Comment editing UI will be implemented in Phase 2
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [comment, _setComment] = useState(projectInfo.comment)
  const [links, setLinks] = useState<ProjectLink[]>(projectInfo.links)

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

  /**
   * Handles note changes from PlateEditor.
   * Enforces maximum length constraint based on text content (not JSON size).
   *
   * @param value - JSON string (Slate format) from PlateEditor
   */
  const handleNoteChange = useCallback((value: string) => {
    try {
      const slateValue = parseSlateValue(value)
      const textLength = getSlateTextLength(slateValue)

      if (textLength <= NOTE_MAX_LENGTH) {
        setNote(value)
      }
    } catch {
      // If parsing fails, still allow the change
      setNote(value)
    }
  }, [])

  /**
   * Add a new empty URL entry and auto-enter edit mode
   */
  const handleAddUrl = useCallback(() => {
    setLinks((prev) => [...prev, { url: '', type: 'vercel' }])
    // Auto-edit the new item (will be handled by autoEdit prop)
  }, [])

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
  const handleUrlChange = useCallback((index: number, url: string) => {
    setLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, url } : link)),
    )
  }, [])

  /**
   * Handle URL type change from EditableUrlItem
   */
  const handleUrlTypeChange = useCallback((index: number, type: string) => {
    setLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, type } : link)),
    )
  }, [])

  /**
   * Handle URL removal with undo support
   */
  const handleRemoveUrl = useCallback(
    (index: number) => {
      const linkToDelete = links[index]
      if (!linkToDelete) return
      setDeletedLink({ link: linkToDelete, index })
      setLinks((prev) => prev.filter((_, i) => i !== index))
      if (editingUrlIndex === index) {
        setEditingUrlIndex(null)
      }
    },
    [links, editingUrlIndex],
  )

  /**
   * Handle undo delete
   */
  const handleUndoDelete = useCallback(() => {
    if (!deletedLink) return
    const { link, index } = deletedLink
    setLinks((prev) => {
      const newLinks = [...prev]
      newLinks.splice(Math.min(index, prev.length), 0, link)
      return newLinks
    })
    setDeletedLink(null)
  }, [deletedLink])

  const handleSave = () => {
    onSave({
      note,
      comment,
      links: links.filter((link) => link.url),
    })
    onClose()
  }

  const handleCancel = useCallback(() => {
    // State will reset automatically when modal reopens (via key pattern)
    onClose()
  }, [onClose])

  // Keyboard handler for Escape key - form is only rendered when dialog is open
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
      }
    },
    [handleCancel],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Form is valid if all URLs are valid (using the new isValidUrl utility)
  const isFormValid = links.every(
    (link) => !link.url || isValidUrl(link.url).valid,
  )

  // Calculate text length from JSON (Slate format) for character count
  const charCount = useMemo(() => {
    try {
      const slateValue = parseSlateValue(note)
      return getSlateTextLength(slateValue)
    } catch {
      return 0
    }
  }, [note])

  const isNearLimit = charCount >= NOTE_WARNING_THRESHOLD

  const charCountClassName = useMemo(
    () =>
      `${CHAR_COUNT_BASE} ${isNearLimit ? CHAR_COUNT_WARNING : CHAR_COUNT_NORMAL}`,
    [isNearLimit],
  )

  return (
    <DialogContent
      className="max-w-4xl max-h-[90vh] overflow-y-auto"
      data-testid="project-info-modal"
      aria-labelledby="project-info-title"
      aria-describedby="project-info-description"
    >
      <DialogHeader>
        <DialogTitle id="project-info-title">Project Info</DialogTitle>
        <DialogDescription id="project-info-description">
          Save notes and related links for your project
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Note Section - Rich Text Editor */}
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <PlateEditor
            data-testid="note-editor"
            initialValue={note}
            onChange={handleNoteChange}
            placeholder="Type / for commands, or start writing..."
            minHeight="300px"
            autoFocus
          />
          <div
            id="char-count"
            data-testid="char-count"
            className={charCountClassName}
          >
            {charCount} / {NOTE_MAX_LENGTH}
          </div>
        </div>

        {/* Links Section - Using EditableUrlItem for inline editing */}
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

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          data-testid="cancel-button"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isFormValid}
          data-testid="save-button"
        >
          Save
        </Button>
      </DialogFooter>

      {/* Create Custom Link Type Dialog */}
      <CreateLinkTypeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handlePresetCreated}
      />
    </DialogContent>
  )
})

/**
 * Project Info Modal Component
 *
 * A modal dialog for editing project information.
 * - Note (max 20,000 characters) with rich text editor
 * - Links (55 built-in presets + user-defined custom presets)
 * - WCAG AA accessibility compliance
 *
 * @see lib/constants/link-presets.ts for available presets
 * @see lib/actions/user-presets.ts for custom preset management
 */
export const ProjectInfoModal = memo(function ProjectInfoModal({
  isOpen,
  onClose,
  onSave,
  projectInfo,
}: ProjectInfoModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isOpen && (
        <ProjectInfoForm
          key={projectInfo.id}
          projectInfo={projectInfo}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
})
