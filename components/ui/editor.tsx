/**
 * Plate Editor Components
 *
 * Provides the base Editor and EditorContainer components for Plate.js rich text editor.
 * Uses platejs/react for the core editing functionality.
 */

'use client'

import { PlateContent } from 'platejs/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Editor Container Component
 *
 * Wraps the editor content with proper positioning context.
 * Required for features like cursor overlay to work correctly.
 */
export const EditorContainer = React.memo(function EditorContainer({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative w-full cursor-text caret-primary selection:bg-brand/25',
        className,
      )}
      {...props}
    />
  )
})

/**
 * Editor Component
 *
 * The main editable area for the Plate rich text editor.
 * Styled to match the application's design system.
 */
export const Editor = React.memo(function Editor({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof PlateContent>) {
  return (
    <PlateContent
      className={cn(
        'relative w-full overflow-x-auto whitespace-pre-wrap break-words',
        'min-h-[200px] w-full rounded-md border border-input bg-background px-4 py-3',
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
        className,
      )}
      {...props}
    />
  )
})
