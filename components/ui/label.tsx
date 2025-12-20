/**
 * Label Component
 *
 * A styled label component built on Radix UI Label primitive.
 * - Provides accessible labels for form inputs
 * - Automatic disabled state styling when associated with disabled inputs
 */

'use client'

import * as LabelPrimitive from '@radix-ui/react-label'
import { cva, type VariantProps } from 'class-variance-authority'
import React, { memo, type Ref } from 'react'

import { cn } from '@/lib/utils'

type Props = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
  VariantProps<typeof labelVariants> & {
    ref?: Ref<HTMLLabelElement>
  }

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
)

/**
 * Label Component (React 19)
 *
 * A styled label component built on Radix UI Label primitive.
 * Accepts `ref` as a standard prop (no forwardRef needed in React 19+)
 *
 * @example
 * const ref = useRef<HTMLLabelElement>(null)
 * <Label ref={ref}>Email</Label>
 */
const Label = memo(({ className, ref, ...props }: Props) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))

Label.displayName = 'Label'

export { Label }
