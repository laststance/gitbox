'use client'

/**
 * Custom Toolbar Buttons for NoteModal Editor
 *
 * Simplified toolbar buttons excluding:
 * - AI features (AI, Copilot, Suggestion)
 * - Comment/Discussion features
 * - Media upload features
 * - Export/Import features
 * - Math equation features
 *
 * Includes core formatting features:
 * - Undo/Redo
 * - Text formatting (bold, italic, underline, strikethrough, code, highlight)
 * - Block formatting (headings, blockquote, code block)
 * - Lists (bullet, numbered, todo)
 * - Links and tables
 */

import {
  BoldIcon,
  Code2Icon,
  HighlighterIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react'
import { KEYS } from 'platejs'
import { useEditorReadOnly } from 'platejs/react'
import { memo } from 'react'

import {
  RedoToolbarButton,
  UndoToolbarButton,
} from '@/components/ui/history-toolbar-button'
import {
  IndentToolbarButton,
  OutdentToolbarButton,
} from '@/components/ui/indent-toolbar-button'
import { InsertToolbarButton } from '@/components/ui/insert-toolbar-button'
import { LinkToolbarButton } from '@/components/ui/link-toolbar-button'
import {
  BulletedListToolbarButton,
  NumberedListToolbarButton,
  TodoListToolbarButton,
} from '@/components/ui/list-toolbar-button'
import { MarkToolbarButton } from '@/components/ui/mark-toolbar-button'
import { TableToolbarButton } from '@/components/ui/table-toolbar-button'
import { ToolbarGroup } from '@/components/ui/toolbar'
import { TurnIntoToolbarButton } from '@/components/ui/turn-into-toolbar-button'

/**
 * Fixed Toolbar Buttons for NoteModal
 *
 * Always visible at the top of the editor.
 * Provides access to all formatting options without AI features.
 */
export const NoteFixedToolbarButtons = memo(function NoteFixedToolbarButtons() {
  const readOnly = useEditorReadOnly()

  return (
    <div className="flex w-full flex-wrap gap-0.5">
      {!readOnly && (
        <>
          {/* History */}
          <ToolbarGroup>
            <UndoToolbarButton />
            <RedoToolbarButton />
          </ToolbarGroup>

          {/* Insert/Turn Into */}
          <ToolbarGroup>
            <InsertToolbarButton />
            <TurnIntoToolbarButton />
          </ToolbarGroup>

          {/* Text Formatting */}
          <ToolbarGroup>
            <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold (⌘+B)">
              <BoldIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic (⌘+I)">
              <ItalicIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.underline}
              tooltip="Underline (⌘+U)"
            >
              <UnderlineIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.strikethrough}
              tooltip="Strikethrough (⌘+⇧+M)"
            >
              <StrikethroughIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.code} tooltip="Code (⌘+E)">
              <Code2Icon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.highlight} tooltip="Highlight">
              <HighlighterIcon />
            </MarkToolbarButton>
          </ToolbarGroup>

          {/* Lists */}
          <ToolbarGroup>
            <NumberedListToolbarButton />
            <BulletedListToolbarButton />
            <TodoListToolbarButton />
          </ToolbarGroup>

          {/* Insert Elements */}
          <ToolbarGroup>
            <LinkToolbarButton />
            <TableToolbarButton />
          </ToolbarGroup>

          {/* Indentation */}
          <ToolbarGroup>
            <OutdentToolbarButton />
            <IndentToolbarButton />
          </ToolbarGroup>
        </>
      )}
    </div>
  )
})

/**
 * Floating Toolbar Buttons for NoteModal
 *
 * Appears when text is selected.
 * Provides quick access to common formatting options.
 */
export const NoteFloatingToolbarButtons = memo(
  function NoteFloatingToolbarButtons() {
    const readOnly = useEditorReadOnly()

    if (readOnly) return null

    return (
      <ToolbarGroup>
        <TurnIntoToolbarButton />
        <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold (⌘+B)">
          <BoldIcon />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic (⌘+I)">
          <ItalicIcon />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.underline} tooltip="Underline (⌘+U)">
          <UnderlineIcon />
        </MarkToolbarButton>
        <MarkToolbarButton
          nodeType={KEYS.strikethrough}
          tooltip="Strikethrough (⌘+⇧+M)"
        >
          <StrikethroughIcon />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.code} tooltip="Code (⌘+E)">
          <Code2Icon />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.highlight} tooltip="Highlight">
          <HighlighterIcon />
        </MarkToolbarButton>
        <LinkToolbarButton />
      </ToolbarGroup>
    )
  },
)
