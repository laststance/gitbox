/**
 * OverflowMenu Component
 *
 * RepoCard用のアクションメニュー
 * - キーボードショートカット: . (ドット) でメニューを開く
 * - Escape で閉じる
 */

'use client'

import { memo, useEffect, useRef } from 'react'

export interface OverflowMenuProps {
  /** メニューが開いているか */
  isOpen: boolean
  /** メニューを閉じるハンドラー */
  onClose: () => void
  /** Project Info 編集ハンドラー */
  onEditProjectInfo: () => void
  /** Maintenance Modeへ移動ハンドラー */
  onMoveToMaintenance: () => void
  /** カード削除ハンドラー */
  onDelete: () => void
  /** メニューの位置 (カードの右上に配置) */
  position?: { top: number; left: number }
}

/**
 * OverflowMenu
 *
 * RepoCardのアクションメニューを表示
 * - "Edit Project Info": Project Infoモーダルを開く
 * - "Move to Maintenance": Maintenance Modeに移動
 * - "Delete": カードを削除 (確認ダイアログ)
 */
export const OverflowMenu = memo<OverflowMenuProps>(
  ({
    isOpen,
    onClose,
    onEditProjectInfo,
    onMoveToMaintenance,
    onDelete,
    position,
  }) => {
    const menuRef = useRef<HTMLDivElement>(null)

    // Escape キーでメニューを閉じる
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault()
          onClose()
        }
      }

      if (isOpen) {
        document.addEventListener('keydown', handleKeyDown)
        return () => {
          document.removeEventListener('keydown', handleKeyDown)
        }
      }
    }, [isOpen, onClose])

    // メニュー外クリックで閉じる
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          menuRef.current &&
          !menuRef.current.contains(event.target as Node)
        ) {
          onClose()
        }
      }

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
          document.removeEventListener('mousedown', handleClickOutside)
        }
      }
    }, [isOpen, onClose])

    if (!isOpen) {
      return null
    }

    const menuStyle = position
      ? { top: `${position.top}px`, left: `${position.left}px` }
      : undefined

    return (
      <div
        ref={menuRef}
        className="absolute z-50 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        style={menuStyle}
        role="menu"
        aria-orientation="vertical"
      >
        <div className="py-1">
          {/* Edit Project Info */}
          <button
            type="button"
            onClick={() => {
              onEditProjectInfo()
              onClose()
            }}
            className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            role="menuitem"
          >
            <svg
              className="mr-3 h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit Project Info
          </button>

          {/* Move to Maintenance */}
          <button
            type="button"
            onClick={() => {
              onMoveToMaintenance()
              onClose()
            }}
            className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            role="menuitem"
          >
            <svg
              className="mr-3 h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            Move to Maintenance
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

          {/* Delete */}
          <button
            type="button"
            onClick={() => {
              if (
                confirm('Are you sure you want to delete this repository card?')
              ) {
                onDelete()
                onClose()
              }
            }}
            className="flex w-full items-center px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            role="menuitem"
          >
            <svg
              className="mr-3 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        </div>
      </div>
    )
  },
)

OverflowMenu.displayName = 'OverflowMenu'
