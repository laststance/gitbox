/**
 * StatusList Dialog
 *
 * StatusListの追加・編集ダイアログ
 * PRD 3.2: 列CRUD操作、WIP limit設定
 */

'use client'

import React, { useState, useEffect, memo } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { StatusListDomain } from '@/lib/models/domain'

// プリセットカラー（WCAG AA準拠）
const PRESET_COLORS = [
  { name: 'Brown', value: '#8B7355' },
  { name: 'Olive', value: '#6B8E23' },
  { name: 'Orange', value: '#CD853F' },
  { name: 'Blue', value: '#4682B4' },
  { name: 'Green', value: '#556B2F' },
  { name: 'Purple', value: '#8B668B' },
  { name: 'Red', value: '#B22222' },
  { name: 'Teal', value: '#20B2AA' },
  { name: 'Pink', value: '#DB7093' },
  { name: 'Gray', value: '#6B7280' },
]

interface StatusListDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    name: string
    color: string
    wipLimit: number | null
  }) => Promise<void>
  statusList?: StatusListDomain | null
  mode: 'create' | 'edit'
}

/**
 * StatusList追加/編集ダイアログ
 *
 * @param isOpen - ダイアログの表示状態
 * @param onClose - ダイアログを閉じる
 * @param onSave - 保存ハンドラ
 * @param statusList - 編集時の既存データ
 * @param mode - 'create' | 'edit'
 */
export const StatusListDialog = memo(function StatusListDialog({
  isOpen,
  onClose,
  onSave,
  statusList,
  mode,
}: StatusListDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6B7280')
  const [wipLimit, setWipLimit] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 編集モード時は既存データをロード
  useEffect(() => {
    if (statusList && mode === 'edit') {
      setName(statusList.title)
      setColor(statusList.color)
      setWipLimit(statusList.wipLimit > 0 ? String(statusList.wipLimit) : '')
    } else {
      setName('')
      setColor('#6B7280')
      setWipLimit('')
    }
    setError(null)
  }, [statusList, mode, isOpen])

  /**
   * フォーム送信
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    const wipLimitValue = wipLimit.trim() ? parseInt(wipLimit, 10) : null
    if (wipLimitValue !== null && (isNaN(wipLimitValue) || wipLimitValue < 0)) {
      setError('WIP limit must be a positive number')
      return
    }

    try {
      setIsSaving(true)
      await onSave({
        name: name.trim(),
        color,
        wipLimit: wipLimitValue,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Status Column' : 'Edit Status Column'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new status column for your Kanban board.'
              : 'Edit the settings for this status column.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="status-name">Name</Label>
            <Input
              id="status-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., In Progress, Review"
              maxLength={50}
              autoFocus
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={`
                    w-8 h-8 rounded-full border-2 transition-all
                    ${color === preset.value ? 'border-foreground scale-110' : 'border-transparent'}
                  `}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                  aria-label={preset.name}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Label
                htmlFor="custom-color"
                className="text-xs text-muted-foreground"
              >
                Custom:
              </Label>
              <Input
                id="custom-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-8 p-0 border-0 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground font-mono">
                {color}
              </span>
            </div>
          </div>

          {/* WIP Limit */}
          <div className="space-y-2">
            <Label htmlFor="wip-limit">WIP Limit (optional)</Label>
            <Input
              id="wip-limit"
              type="number"
              min="0"
              max="99"
              value={wipLimit}
              onChange={(e) => setWipLimit(e.target.value)}
              placeholder="No limit"
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Work-in-progress limit. Leave empty for no limit.
            </p>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? 'Saving...'
                : mode === 'create'
                  ? 'Add Column'
                  : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
})

export default StatusListDialog
