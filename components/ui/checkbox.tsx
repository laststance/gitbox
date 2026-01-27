'use client'

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import {
  memo,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type Ref,
} from 'react'

import { cn } from '@/lib/utils'

const Checkbox = memo(function Checkbox({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  ref?: Ref<ComponentRef<typeof CheckboxPrimitive.Root>>
}) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn('grid place-content-center text-current')}
      >
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})

export { Checkbox }
