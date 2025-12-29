/**
 * Plate Rich Text Editor Component
 *
 * Full-featured WYSIWYG editor using Plate.js with:
 * - Fixed toolbar (always visible)
 * - Floating toolbar (on text selection)
 * - Slash commands (/ menu)
 * - Text formatting (bold, italic, underline, strikethrough, code, highlight)
 * - Block formatting (headings H1-H6, blockquotes, horizontal rules)
 * - Code blocks with syntax highlighting
 * - Links with floating editor
 * - Tables with row/column operations
 * - Lists (bullet, numbered, todo) with indentation
 * - Markdown autoformat shortcuts
 *
 * Data Format: JSON (Slate format) for rich text preservation.
 *
 * @see https://platejs.org/ for full documentation
 */

'use client'

import { Plate, usePlateEditor } from 'platejs/react'
import { memo, useCallback, useMemo } from 'react'

import { Editor, EditorContainer } from '@/components/ui/editor'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { parseSlateValue, serializeSlateValue } from '@/lib/utils/slate-utils'
import type { SlateValue } from '@/lib/utils/slate-utils'

import { EditorPlugins } from './plugins/editor-plugins'

// ============================================================================
// Types
// ============================================================================

export interface PlateEditorProps {
  /**
   * Initial content as JSON string (Slate format) or plain text (legacy).
   * JSON is the preferred format for rich text preservation.
   */
  initialValue?: string
  /**
   * Callback when content changes - receives JSON string (Slate format).
   * Use parseSlateValue to convert back to Slate value if needed.
   */
  onChange?: (value: string) => void
  /** Placeholder text when editor is empty */
  placeholder?: string
  /** Whether the editor is disabled */
  disabled?: boolean
  /** Additional className for the editor container */
  className?: string
  /** Minimum height for the editor content area */
  minHeight?: string
  /** Maximum height for the editor content area (enables scrolling) */
  maxHeight?: string
  /** data-testid for testing */
  'data-testid'?: string
}

// ============================================================================
// Main PlateEditor Component
// ============================================================================

/**
 * Rich Text Editor using Plate.js
 *
 * Provides a full-featured text editing experience matching platejs.org.
 * Stores content in JSON format for rich text preservation.
 *
 * @example
 * // New usage with JSON format
 * <PlateEditor
 *   initialValue='[{"type":"p","children":[{"text":"Hello world"}]}]'
 *   onChange={(json) => saveToDatabase(json)}
 *   placeholder="Start writing..."
 * />
 *
 * @example
 * // Legacy plain text (auto-converted to JSON on save)
 * <PlateEditor
 *   initialValue="Hello world"
 *   onChange={(json) => saveToDatabase(json)}
 * />
 */
export const PlateEditor = memo(function PlateEditor({
  initialValue = '',
  onChange,
  placeholder = 'Type / for commands...',
  disabled = false,
  className,
  minHeight = '200px',
  maxHeight,
  'data-testid': testId = 'plate-editor',
}: PlateEditorProps) {
  /**
   * Parse initial value from string (JSON or legacy plain text).
   * Memoized to prevent unnecessary re-parsing.
   */
  const initialEditorValue = useMemo<SlateValue>(
    () => parseSlateValue(initialValue),
    [initialValue],
  )

  /**
   * Create the Plate editor with full plugin configuration.
   * EditorPlugins includes all features except AI.
   */
  const editor = usePlateEditor({
    plugins: EditorPlugins,
    value: initialEditorValue,
  })

  /**
   * Handle editor content changes.
   * Serializes the Slate value to JSON string for storage.
   */
  const handleChange = useCallback(
    ({ value }: { value: SlateValue }) => {
      if (onChange) {
        const jsonString = serializeSlateValue(value)
        onChange(jsonString)
      }
    },
    [onChange],
  )

  return (
    <TooltipProvider>
      <div
        className={cn('flex flex-col', className)}
        data-testid={testId}
        aria-label="Rich text editor"
      >
        <Plate editor={editor} onChange={handleChange}>
          <EditorContainer
            className={cn(
              'rounded-lg border border-input bg-background shadow-sm',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            style={{ minHeight, maxHeight }}
          >
            <Editor
              placeholder={placeholder}
              disabled={disabled}
              aria-disabled={disabled}
              variant="fullWidth"
              className={cn(
                'px-4 py-3',
                // Ensure proper min height for the editable area
                'min-h-[150px]',
              )}
            />
          </EditorContainer>
        </Plate>
      </div>
    </TooltipProvider>
  )
})

export default PlateEditor
