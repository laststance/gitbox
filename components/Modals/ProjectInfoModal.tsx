'use client'

import { Plus, X } from 'lucide-react'
import { useState, useEffect, useCallback, memo, useMemo } from 'react'

import { PlateEditor } from '@/components/editor/PlateEditor'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProjectLink } from '@/lib/actions/project-info'
import { getSlateTextLength, parseSlateValue } from '@/lib/utils/slate-utils'

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

const URL_REGEX = /^https?:\/\/.+/

const validateUrl = (url: string): boolean => {
  return URL_REGEX.test(url)
}

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
  const [urlErrors, setUrlErrors] = useState<Map<number, string>>(new Map())

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

  const handleAddUrl = () => {
    setLinks([...links, { url: '', type: 'production' }])
  }

  const handleRemoveUrl = (index: number) => {
    setLinks(links.filter((_, i) => i !== index))
    const newErrors = new Map(urlErrors)
    newErrors.delete(index)
    setUrlErrors(newErrors)
  }

  const handleUrlChange = (index: number, url: string) => {
    const newLinks = [...links]
    newLinks[index] = { ...newLinks[index], url }
    setLinks(newLinks)

    // Validate URL
    const newErrors = new Map(urlErrors)
    if (url && !validateUrl(url)) {
      newErrors.set(index, 'Please enter a valid URL')
    } else {
      newErrors.delete(index)
    }
    setUrlErrors(newErrors)
  }

  const handleUrlTypeChange = (index: number, type: ProjectLink['type']) => {
    const newLinks = [...links]
    newLinks[index] = { ...newLinks[index], type }
    setLinks(newLinks)
  }

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

  const isFormValid =
    urlErrors.size === 0 &&
    links.every((link) => !link.url || validateUrl(link.url))

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

  /**
   * Memoized classNames for URL input error states.
   * Only recomputes when urlErrors changes.
   */
  const urlInputClassNames = useMemo(() => {
    const classNames = new Map<number, string | undefined>()
    links.forEach((_, index) => {
      classNames.set(
        index,
        urlErrors.has(index) ? 'border-destructive' : undefined,
      )
    })
    return classNames
  }, [links, urlErrors])

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
                <li key={index} className="space-y-2">
                  <div className="flex gap-2">
                    <Select
                      value={link.type}
                      onValueChange={(value) =>
                        handleUrlTypeChange(index, value as ProjectLink['type'])
                      }
                    >
                      <SelectTrigger
                        className="w-45"
                        data-testid="url-type-select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="tracking">Tracking</SelectItem>
                        <SelectItem value="supabase">Supabase</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="url"
                      placeholder="https://example.com"
                      value={link.url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      data-testid={`url-input-${index}`}
                      className={urlInputClassNames.get(index)}
                      aria-invalid={urlErrors.has(index)}
                      aria-describedby={
                        urlErrors.has(index) ? 'url-error' : undefined
                      }
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveUrl(index)}
                      data-testid={`remove-url-${index}`}
                      aria-label={`Delete URL ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {urlErrors.has(index) && (
                    <p
                      id="url-error"
                      data-testid="url-error"
                      className="text-sm text-destructive"
                      role="alert"
                    >
                      {urlErrors.get(index)}
                    </p>
                  )}

                  {link.url && validateUrl(link.url) && (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center"
                    >
                      {new URL(link.url).hostname}
                    </a>
                  )}
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
    </DialogContent>
  )
})

/**
 * Project Info Modal Component
 *
 * A modal dialog for editing project information.
 * - Note (max 20,000 characters)
 * - Links (Production URL, Tracking services, Supabase Dashboard)
 * - WCAG AA accessibility compliance
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
