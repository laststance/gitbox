'use client'

import { Plus } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'

import { CreateLinkTypeDialog } from '@/components/Modals/CreateLinkTypeDialog'
import { Button } from '@/components/ui/button'
import {
  EditableUrlItem,
  type ProjectLink,
} from '@/components/ui/editable-url-item'
import { Label } from '@/components/ui/label'
import { type UserPresetOption } from '@/components/ui/link-type-combobox'
import { getUserPresets, type UserPreset } from '@/lib/actions/user-presets'

interface LinkManagerProps {
  /** Current links array */
  links: ProjectLink[]
  /** Callback when links change (add, edit, delete) */
  onLinksChange: (links: ProjectLink[]) => void
}

/**
 * Link management section within NoteModal.
 *
 * Manages link CRUD operations with:
 * - Single-edit coordination (one URL edited at a time)
 * - Undo delete support
 * - User custom presets + built-in presets
 * - Create custom link type dialog
 *
 * @example
 * <LinkManager
 *   links={links}
 *   onLinksChange={handleLinksChange}
 * />
 */
export const LinkManager = memo(function LinkManager({
  links,
  onLinksChange,
}: LinkManagerProps) {
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
      .then((result) => {
        if (mounted && result.success) {
          setUserPresets(result.data)
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
   * Add a new empty URL entry and auto-enter edit mode
   */
  const handleAddUrl = useCallback(() => {
    const nextIndex = links.length
    setEditingUrlIndex(nextIndex)
    onLinksChange([...links, { url: '', type: 'vercel' }])
  }, [links, onLinksChange])

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
      onLinksChange(newLinks)
    },
    [links, onLinksChange],
  )

  /**
   * Handle URL type change from EditableUrlItem
   */
  const handleUrlTypeChange = useCallback(
    (index: number, type: string) => {
      const newLinks = links.map((link, i) =>
        i === index ? { ...link, type } : link,
      )
      onLinksChange(newLinks)
    },
    [links, onLinksChange],
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
      if (editingUrlIndex === index) {
        setEditingUrlIndex(null)
      } else if (editingUrlIndex !== null && index < editingUrlIndex) {
        setEditingUrlIndex(editingUrlIndex - 1)
      }
      onLinksChange(newLinks)
    },
    [editingUrlIndex, links, onLinksChange],
  )

  /**
   * Handle undo delete
   */
  const handleUndoDelete = useCallback(() => {
    if (!deletedLink) return
    const { link, index } = deletedLink
    const insertIndex = Math.min(index, links.length)
    const newLinks = [...links]
    newLinks.splice(insertIndex, 0, link)
    if (editingUrlIndex !== null && insertIndex <= editingUrlIndex) {
      setEditingUrlIndex(editingUrlIndex + 1)
    }
    setDeletedLink(null)
    onLinksChange(newLinks)
  }, [deletedLink, editingUrlIndex, links, onLinksChange])

  return (
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
          <Plus className="mr-1 h-4 w-4" />
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

      {/* Create Custom Link Type Dialog */}
      <CreateLinkTypeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handlePresetCreated}
      />
    </div>
  )
})
