'use client'

import * as SeparatorPrimitive from '@radix-ui/react-separator'
import {
  memo,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type Ref,
} from 'react'

import { cn } from '@/lib/utils'

const Separator = memo(function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & {
  ref?: Ref<ComponentRef<typeof SeparatorPrimitive.Root>>
}) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className,
      )}
      {...props}
    />
  )
})

export { Separator }
