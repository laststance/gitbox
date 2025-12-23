'use client'

import { Plus, X, Eye, EyeOff } from 'lucide-react'
import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import type { Credential, ProjectLink } from '@/lib/actions/project-info'
import { generateMaskedDisplay } from '@/lib/encryption'

/** Base styles for character count */
const CHAR_COUNT_BASE = 'text-sm text-right'
const CHAR_COUNT_WARNING = 'text-warning'
const CHAR_COUNT_NORMAL = 'text-muted-foreground'

export interface ProjectInfo {
  id: string
  quickNote: string
  links: ProjectLink[]
  credentials?: Credential[]
}

interface ProjectInfoModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    quickNote: string
    links: ProjectLink[]
    credentials: Credential[]
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
  const [quickNote, setQuickNote] = useState(projectInfo.quickNote)
  const [links, setLinks] = useState<ProjectLink[]>(projectInfo.links)
  const [credentials, setCredentials] = useState<Credential[]>(
    projectInfo.credentials || [],
  )
  const [urlErrors, setUrlErrors] = useState<Map<number, string>>(new Map())
  const [revealedCredentials, setRevealedCredentials] = useState<Set<number>>(
    new Set(),
  )
  // Use ref to track timers to avoid dependency issues in useEffect
  const revealTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map())

  // Cleanup timers on unmount
  useEffect(() => {
    const timersRef = revealTimersRef
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= NOTE_MAX_LENGTH) {
      setQuickNote(value)
    }
  }

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

  // Credentials handlers
  const handleAddCredential = () => {
    setCredentials([
      ...credentials,
      { type: 'reference', name: '', reference: '' },
    ])
  }

  const handleRemoveCredential = (index: number) => {
    setCredentials(credentials.filter((_, i) => i !== index))
  }

  const handleCredentialChange = (
    index: number,
    field: keyof Credential,
    value: string,
  ) => {
    const newCredentials = [...credentials]
    newCredentials[index] = { ...newCredentials[index], [field]: value }

    // Auto-generate masked display when encrypted_value changes
    if (field === 'encrypted_value' && value) {
      newCredentials[index].masked_display = generateMaskedDisplay(value)
    }

    setCredentials(newCredentials)
  }

  const toggleRevealCredential = (index: number) => {
    setRevealedCredentials((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        // Hiding: clear the timer
        newSet.delete(index)
        const timer = revealTimersRef.current.get(index)
        if (timer) {
          clearTimeout(timer)
          revealTimersRef.current.delete(index)
        }
      } else {
        // Revealing: add to set and start 30-second timer
        newSet.add(index)

        // Clear existing timer if any
        const existingTimer = revealTimersRef.current.get(index)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        // Start new 30-second auto-hide timer
        const timer = setTimeout(() => {
          setRevealedCredentials((current) => {
            const updated = new Set(current)
            updated.delete(index)
            return updated
          })
          revealTimersRef.current.delete(index)
        }, 30000) // 30 seconds

        revealTimersRef.current.set(index, timer)
      }
      return newSet
    })
  }

  const handleCredentialTypeChange = (
    index: number,
    type: Credential['type'],
  ) => {
    const newCredentials = [...credentials]
    // Reset type-specific fields when changing type
    const baseCredential = {
      type,
      name: newCredentials[index].name,
      note: newCredentials[index].note,
    }

    if (type === 'reference') {
      newCredentials[index] = { ...baseCredential, reference: '' }
    } else if (type === 'encrypted') {
      newCredentials[index] = {
        ...baseCredential,
        encrypted_value: '',
        masked_display: '',
      }
    } else if (type === 'external') {
      newCredentials[index] = { ...baseCredential, location: '' }
    }

    setCredentials(newCredentials)
  }

  const handleSave = () => {
    onSave({
      quickNote,
      links: links.filter((link) => link.url),
      credentials: credentials.filter((cred) => cred.name),
    })
    onClose()
  }

  const handleCancel = useCallback(() => {
    // Clear all timers before closing
    revealTimersRef.current.forEach((timer) => clearTimeout(timer))
    revealTimersRef.current = new Map()

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
  const charCount = quickNote.length
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
      className="sm:max-w-[600px]"
      data-testid="project-info-modal"
      aria-labelledby="project-info-title"
      aria-describedby="project-info-description"
    >
      <DialogHeader>
        <DialogTitle id="project-info-title">Project Info</DialogTitle>
        <DialogDescription id="project-info-description">
          Save quick notes and related links for your project
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Note Section */}
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Textarea
            id="note"
            data-testid="note-textarea"
            placeholder="Project notes"
            value={quickNote}
            onChange={handleNoteChange}
            maxLength={NOTE_MAX_LENGTH}
            rows={3}
            autoFocus
            aria-describedby="char-count"
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
                        className="w-[180px]"
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

        {/* Credentials Section (US5) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Credentials</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCredential}
              data-testid="add-credential-button"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Credential
            </Button>
          </div>

          {credentials.length > 0 && (
            <ul className="space-y-3" data-testid="credential-list">
              {credentials.map((credential, index) => (
                <li key={index} className="space-y-2 p-4 border rounded-lg">
                  <div className="flex gap-2">
                    <Select
                      value={credential.type}
                      onValueChange={(value) =>
                        handleCredentialTypeChange(
                          index,
                          value as Credential['type'],
                        )
                      }
                    >
                      <SelectTrigger
                        className="w-[180px]"
                        data-testid={`credential-type-select-${index}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reference">Reference</SelectItem>
                        <SelectItem value="encrypted">Encrypted</SelectItem>
                        <SelectItem value="external">External</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="text"
                      placeholder="Credential name"
                      value={credential.name}
                      onChange={(e) =>
                        handleCredentialChange(index, 'name', e.target.value)
                      }
                      data-testid={`credential-name-${index}`}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCredential(index)}
                      data-testid={`remove-credential-${index}`}
                      aria-label={`Delete credential ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Pattern A: Reference */}
                  {credential.type === 'reference' && (
                    <Input
                      type="url"
                      placeholder="Dashboard URL (e.g., https://dashboard.stripe.com)"
                      value={credential.reference || ''}
                      onChange={(e) =>
                        handleCredentialChange(
                          index,
                          'reference',
                          e.target.value,
                        )
                      }
                      data-testid={`credential-reference-${index}`}
                    />
                  )}

                  {/* Pattern B: Encrypted */}
                  {credential.type === 'encrypted' && (
                    <div className="relative">
                      <Input
                        type={
                          revealedCredentials.has(index) ? 'text' : 'password'
                        }
                        placeholder="Secret value (will be encrypted)"
                        value={
                          revealedCredentials.has(index)
                            ? credential.encrypted_value || ''
                            : credential.masked_display ||
                              credential.encrypted_value ||
                              ''
                        }
                        onChange={(e) =>
                          handleCredentialChange(
                            index,
                            'encrypted_value',
                            e.target.value,
                          )
                        }
                        data-testid={`credential-encrypted-${index}`}
                        className="pr-10"
                      />
                      {credential.encrypted_value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleRevealCredential(index)}
                          data-testid={`toggle-reveal-${index}`}
                          aria-label={
                            revealedCredentials.has(index)
                              ? 'Hide value'
                              : 'Reveal value'
                          }
                          className="absolute right-0 top-0 h-full"
                        >
                          {revealedCredentials.has(index) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Pattern C: External */}
                  {credential.type === 'external' && (
                    <Input
                      type="text"
                      placeholder="Location (e.g., 1Password > Team Vault > Production)"
                      value={credential.location || ''}
                      onChange={(e) =>
                        handleCredentialChange(
                          index,
                          'location',
                          e.target.value,
                        )
                      }
                      data-testid={`credential-location-${index}`}
                    />
                  )}

                  {/* Optional Note */}
                  <Input
                    type="text"
                    placeholder="Note (optional)"
                    value={credential.note || ''}
                    onChange={(e) =>
                      handleCredentialChange(index, 'note', e.target.value)
                    }
                    data-testid={`credential-note-${index}`}
                    className="text-sm"
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
    </DialogContent>
  )
})

/**
 * Project Info Modal Component
 *
 * A modal dialog for editing project information.
 * - Note (max 20,000 characters)
 * - Links (Production URL, Tracking services, Supabase Dashboard)
 * - Credentials management with three patterns:
 *   - Reference: Dashboard URL only
 *   - Encrypted: AES-256-GCM encryption
 *   - External: 1Password/Bitwarden location
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
