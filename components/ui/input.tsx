/**
 * Input Component (React 19)
 *
 * A styled input component for text input fields.
 * - Supports all standard HTML input attributes and types
 * - Proper focus states, disabled states, and placeholder styling
 * - Accepts `ref` as a standard prop (no forwardRef needed in React 19+)
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

type InputProps = React.ComponentProps<'input'> & {
  ref?: React.Ref<HTMLInputElement>
}

/**
 * Input element with consistent styling
 *
 * @example
 * const ref = useRef<HTMLInputElement>(null)
 * <Input ref={ref} type="email" placeholder="Enter email" />
 */
const Input = React.memo(({ className, type, ref, ...props }: InputProps) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
