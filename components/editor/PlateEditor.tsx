/**
 * Plate Rich Text Editor Component
 *
 * A full-featured rich text editor using Plate.js with:
 * - Bold, Italic, Underline formatting
 * - Headings (H1, H2, H3)
 * - Lists (bullet, numbered)
 * - Blockquotes
 * - Inline code
 * - Keyboard shortcuts (Cmd/Ctrl+B, I, U, etc.)
 *
 * @see https://platejs.org/ for full documentation
 */

'use client'

import {
  BoldPlugin,
  CodePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react'
import {
  Plate,
  PlateContent,
  useEditorRef,
  usePlateEditor,
} from 'platejs/react'
import { memo, useCallback, useMemo } from 'react'

import {
  Toolbar,
  ToolbarSeparator,
  ToolbarToggleGroup,
  ToolbarToggleItem,
} from '@/components/ui/toolbar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface PlateEditorProps {
  /** Initial content as plain text (will be converted to editor format) */
  initialValue?: string
  /** Callback when content changes - receives plain text */
  onChange?: (value: string) => void
  /** Placeholder text when editor is empty */
  placeholder?: string
  /** Whether the editor is disabled */
  disabled?: boolean
  /** Additional className for the editor container */
  className?: string
  /** Minimum height for the editor */
  minHeight?: string
  /** data-testid for testing */
  'data-testid'?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts plain text to Plate editor value format.
 *
 * @param text - Plain text string
 * @returns Plate editor value array
 */
const textToSlateValue = (text: string) => {
  if (!text) {
    return [{ type: 'p', children: [{ text: '' }] }]
  }

  return text.split('\n').map((line) => ({
    type: 'p',
    children: [{ text: line }],
  }))
}

/**
 * Converts Plate editor value to plain text.
 *
 * @param value - Plate editor value array
 * @returns Plain text string
 */
const slateValueToText = (value: unknown[]): string => {
  const extractText = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''

    const nodeObj = node as Record<string, unknown>

    if ('text' in nodeObj && typeof nodeObj.text === 'string') {
      return nodeObj.text
    }

    if ('children' in nodeObj && Array.isArray(nodeObj.children)) {
      return nodeObj.children.map(extractText).join('')
    }

    return ''
  }

  return value.map(extractText).join('\n')
}

// ============================================================================
// Toolbar Button Component
// ============================================================================

interface ToolbarButtonProps {
  value: string
  tooltip: string
  shortcut?: string
  children: React.ReactNode
  onToggle: () => void
  isActive: boolean
}

const ToolbarButtonWithTooltip = memo(function ToolbarButtonWithTooltip({
  value,
  tooltip,
  shortcut,
  children,
  onToggle,
  isActive,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToolbarToggleItem
          value={value}
          aria-label={tooltip}
          onClick={(e) => {
            e.preventDefault()
            onToggle()
          }}
          data-state={isActive ? 'on' : 'off'}
        >
          {children}
        </ToolbarToggleItem>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {tooltip}
          {shortcut && (
            <span className="ml-2 text-muted-foreground">{shortcut}</span>
          )}
        </p>
      </TooltipContent>
    </Tooltip>
  )
})

// ============================================================================
// Editor Toolbar Component
// ============================================================================

const EditorToolbar = memo(function EditorToolbar() {
  const editor = useEditorRef()

  /**
   * Toggles a mark (bold, italic, etc.) on the current selection.
   */
  const toggleMark = useCallback(
    (mark: string) => {
      if (editor) {
        editor.tf.toggleMark(mark)
      }
    },
    [editor],
  )

  /**
   * Checks if a mark is active at the current selection.
   */
  const isMarkActive = useCallback(
    (mark: string): boolean => {
      if (!editor) return false
      try {
        const getMarks = editor.getMarks as
          | (() => Record<string, boolean> | null)
          | undefined
        if (typeof getMarks === 'function') {
          const marks = getMarks()
          return marks ? mark in marks && !!marks[mark] : false
        }
        return false
      } catch {
        return false
      }
    },
    [editor],
  )

  return (
    <Toolbar className="mb-2 flex-wrap">
      <ToolbarToggleGroup type="multiple" aria-label="Text formatting">
        <ToolbarButtonWithTooltip
          value="bold"
          tooltip="Bold"
          shortcut="⌘B"
          onToggle={() => toggleMark('bold')}
          isActive={isMarkActive('bold')}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButtonWithTooltip>

        <ToolbarButtonWithTooltip
          value="italic"
          tooltip="Italic"
          shortcut="⌘I"
          onToggle={() => toggleMark('italic')}
          isActive={isMarkActive('italic')}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButtonWithTooltip>

        <ToolbarButtonWithTooltip
          value="underline"
          tooltip="Underline"
          shortcut="⌘U"
          onToggle={() => toggleMark('underline')}
          isActive={isMarkActive('underline')}
        >
          <Underline className="h-4 w-4" />
        </ToolbarButtonWithTooltip>

        <ToolbarButtonWithTooltip
          value="strikethrough"
          tooltip="Strikethrough"
          onToggle={() => toggleMark('strikethrough')}
          isActive={isMarkActive('strikethrough')}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButtonWithTooltip>

        <ToolbarButtonWithTooltip
          value="code"
          tooltip="Code"
          shortcut="⌘E"
          onToggle={() => toggleMark('code')}
          isActive={isMarkActive('code')}
        >
          <Code className="h-4 w-4" />
        </ToolbarButtonWithTooltip>
      </ToolbarToggleGroup>

      <ToolbarSeparator />

      <ToolbarToggleGroup type="single" aria-label="Headings">
        <ToolbarButtonWithTooltip
          value="h1"
          tooltip="Heading 1"
          onToggle={() => editor?.tf.toggleBlock?.('h1')}
          isActive={false}
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButtonWithTooltip>

        <ToolbarButtonWithTooltip
          value="h2"
          tooltip="Heading 2"
          onToggle={() => editor?.tf.toggleBlock?.('h2')}
          isActive={false}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButtonWithTooltip>

        <ToolbarButtonWithTooltip
          value="h3"
          tooltip="Heading 3"
          onToggle={() => editor?.tf.toggleBlock?.('h3')}
          isActive={false}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButtonWithTooltip>
      </ToolbarToggleGroup>

      <ToolbarSeparator />

      <ToolbarToggleGroup type="single" aria-label="Lists">
        <ToolbarButtonWithTooltip
          value="ul"
          tooltip="Bullet List"
          onToggle={() => editor?.tf.toggleBlock?.('ul')}
          isActive={false}
        >
          <List className="h-4 w-4" />
        </ToolbarButtonWithTooltip>

        <ToolbarButtonWithTooltip
          value="ol"
          tooltip="Numbered List"
          onToggle={() => editor?.tf.toggleBlock?.('ol')}
          isActive={false}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButtonWithTooltip>

        <ToolbarButtonWithTooltip
          value="blockquote"
          tooltip="Quote"
          onToggle={() => editor?.tf.toggleBlock?.('blockquote')}
          isActive={false}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButtonWithTooltip>
      </ToolbarToggleGroup>
    </Toolbar>
  )
})

// ============================================================================
// Plate Leaf Components
// ============================================================================

interface LeafProps {
  children: React.ReactNode
}

/**
 * Bold leaf component - renders bold text.
 */
const BoldLeaf = memo(function BoldLeaf({ children }: LeafProps) {
  return <strong className="font-bold">{children}</strong>
})

/**
 * Italic leaf component - renders italic text.
 */
const ItalicLeaf = memo(function ItalicLeaf({ children }: LeafProps) {
  return <em className="italic">{children}</em>
})

/**
 * Underline leaf component - renders underlined text.
 */
const UnderlineLeaf = memo(function UnderlineLeaf({ children }: LeafProps) {
  return <u className="underline">{children}</u>
})

/**
 * Strikethrough leaf component - renders struck through text.
 */
const StrikethroughLeaf = memo(function StrikethroughLeaf({
  children,
}: LeafProps) {
  return <s className="line-through">{children}</s>
})

/**
 * Code leaf component - renders inline code.
 */
const CodeLeaf = memo(function CodeLeaf({ children }: LeafProps) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
      {children}
    </code>
  )
})

// ============================================================================
// Main PlateEditor Component
// ============================================================================

/**
 * Rich Text Editor using Plate.js
 *
 * Provides a full-featured text editing experience with formatting toolbar.
 *
 * @example
 * <PlateEditor
 *   initialValue="Hello **world**"
 *   onChange={(text) => console.log(text)}
 *   placeholder="Start writing..."
 * />
 */
export const PlateEditor = memo(function PlateEditor({
  initialValue = '',
  onChange,
  placeholder = 'Start writing...',
  disabled = false,
  className,
  minHeight = '200px',
  'data-testid': testId = 'plate-editor',
}: PlateEditorProps) {
  /**
   * Initial editor value converted from plain text.
   */
  const initialEditorValue = useMemo(
    () => textToSlateValue(initialValue),
    [initialValue],
  )

  /**
   * Create the Plate editor with plugins.
   */
  const editor = usePlateEditor({
    plugins: [
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      StrikethroughPlugin,
      CodePlugin,
    ],
    value: initialEditorValue,
    override: {
      components: {
        bold: BoldLeaf,
        italic: ItalicLeaf,
        underline: UnderlineLeaf,
        strikethrough: StrikethroughLeaf,
        code: CodeLeaf,
      },
    },
  })

  /**
   * Handle editor content changes.
   */
  const handleChange = useCallback(
    ({ value }: { value: unknown[] }) => {
      if (onChange) {
        const text = slateValueToText(value)
        onChange(text)
      }
    },
    [onChange],
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn('flex flex-col', className)}
        data-testid={testId}
        aria-label="Rich text editor"
      >
        <Plate editor={editor} onChange={handleChange}>
          <EditorToolbar />
          <PlateContent
            className={cn(
              'relative w-full overflow-x-auto whitespace-pre-wrap break-words',
              'w-full rounded-md border border-input bg-background px-4 py-3',
              'text-base ring-offset-background',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              '[&_strong]:font-bold [&_em]:italic [&_u]:underline',
              '[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4',
              '[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3',
              '[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-2',
              '[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic',
              '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-2',
              '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-2',
              '[&_li]:mb-1',
              '[&_a]:text-primary [&_a]:underline',
              '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            style={{ minHeight }}
            placeholder={placeholder}
            disabled={disabled}
            aria-disabled={disabled}
          />
        </Plate>
      </div>
    </TooltipProvider>
  )
})

export default PlateEditor
