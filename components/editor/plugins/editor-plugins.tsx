'use client'

/**
 * NoteModal Editor Plugin Configuration
 *
 * Full-featured Plate editor plugins excluding AI features.
 * Includes: Basic blocks, marks, code blocks, links, tables, lists,
 *           autoformat, slash commands, and toolbars.
 *
 * @see https://platejs.org for official documentation
 */

import { createPlatePlugin } from 'platejs/react'

// Plugin Kits - Import from installed registry components
import { FixedToolbar } from '@/components/ui/fixed-toolbar'
import { FloatingToolbar } from '@/components/ui/floating-toolbar'

import {
  NoteFixedToolbarButtons,
  NoteFloatingToolbarButtons,
} from '../note-toolbar-buttons'

import { AutoformatKit } from './autoformat-kit'
import { BasicBlocksKit } from './basic-blocks-kit'
import { BasicMarksKit } from './basic-marks-kit'
import { CodeBlockKit } from './code-block-kit'
import { LinkKit } from './link-kit'
import { ListKit } from './list-kit'
import { SlashKit } from './slash-kit'
import { TableKit } from './table-kit'

// Custom toolbar buttons without AI features

/**
 * Custom Fixed Toolbar Kit for NoteModal
 * Uses NoteFixedToolbarButtons which excludes AI features
 */
const NoteFixedToolbarKit = [
  createPlatePlugin({
    key: 'fixed-toolbar',
    render: {
      beforeEditable: () => (
        <FixedToolbar>
          <NoteFixedToolbarButtons />
        </FixedToolbar>
      ),
    },
  }),
]

/**
 * Custom Floating Toolbar Kit for NoteModal
 * Uses NoteFloatingToolbarButtons which excludes AI features
 */
const NoteFloatingToolbarKit = [
  createPlatePlugin({
    key: 'floating-toolbar',
    render: {
      afterEditable: () => (
        <FloatingToolbar>
          <NoteFloatingToolbarButtons />
        </FloatingToolbar>
      ),
    },
  }),
]

/**
 * Core editor plugins for NoteModal.
 * Combines all feature kits into a single array for usePlateEditor.
 *
 * Feature Set:
 * - Basic Blocks: Paragraphs, Headings (H1-H6), Blockquotes, Horizontal Rules
 * - Basic Marks: Bold, Italic, Underline, Strikethrough, Code, Highlight, Kbd
 * - Code Blocks: Syntax-highlighted code blocks with language selection
 * - Links: Inline links with floating toolbar for editing
 * - Tables: Full table support with row/column operations
 * - Lists: Bullet, numbered, and todo lists with indentation
 * - Autoformat: Markdown shortcuts (# for headings, ** for bold, etc.)
 * - Slash Commands: / menu for quick insertion
 * - Fixed Toolbar: Always-visible formatting toolbar (custom, no AI)
 * - Floating Toolbar: Context-aware toolbar on text selection (custom, no AI)
 *
 * Excluded (AI features):
 * - AI Plugin
 * - Copilot Plugin
 * - Suggestion Plugin
 * - Comment/Discussion Plugin
 * - Mention Plugin (requires backend)
 * - Media Plugin (requires upload backend)
 */
export const EditorPlugins = [
  // Block-level elements
  ...BasicBlocksKit,

  // Inline marks (bold, italic, etc.)
  ...BasicMarksKit,

  // Code blocks with syntax highlighting
  ...CodeBlockKit,

  // Hyperlinks
  ...LinkKit,

  // Tables
  ...TableKit,

  // Lists (bullet, numbered, todo) with indentation
  ...ListKit,

  // Markdown autoformat rules
  ...AutoformatKit,

  // Slash command menu
  ...SlashKit,

  // Custom fixed toolbar (always visible at top, no AI)
  ...NoteFixedToolbarKit,

  // Custom floating toolbar (appears on text selection, no AI)
  ...NoteFloatingToolbarKit,
]
