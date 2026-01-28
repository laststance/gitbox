'use client'

import * as SwitchPrimitives from '@radix-ui/react-switch'
import {
  memo,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type Ref,
} from 'react'

import { cn } from '@/lib/utils'

/**
 * Switch component
 *
 * A toggle control for binary on/off settings.
 * Built on Radix UI Switch primitive.
 *
 * @example
 * <Switch
 *   id="airplane-mode"
 *   checked={enabled}
 *   onCheckedChange={setEnabled}
 * />
 */
const Switch = memo(function Switch({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  ref?: Ref<ComponentRef<typeof SwitchPrimitives.Root>>
}) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className,
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
          'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitives.Root>
  )
})

export { Switch }
