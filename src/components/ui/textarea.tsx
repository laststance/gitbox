/**
 * Textarea Component (React 19)
 *
 * A styled textarea component for multi-line text input.
 * - Supports all standard HTML textarea attributes
 * - Proper focus states, disabled states, and placeholder styling
 * - Accepts `ref` as a standard prop (no forwardRef needed in React 19+)
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

type TextareaProps = React.ComponentProps<'textarea'> & {
  ref?: React.Ref<HTMLTextAreaElement>
}

/**
 * Textarea element with consistent styling
 *
 * @example
 * const ref = useRef<HTMLTextAreaElement>(null)
 * <Textarea ref={ref} placeholder="Enter description" />
 */
const Textarea = React.memo(({ className, ref, ...props }: TextareaProps) => {
  return (
    <textarea
      className={cn(
        'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-20 w-full rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
