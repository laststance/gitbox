'use client'

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Circle } from 'lucide-react'
import {
  memo,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type Ref,
} from 'react'

import { cn } from '@/lib/utils'

const RadioGroup = memo(function RadioGroup({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & {
  ref?: Ref<ComponentRef<typeof RadioGroupPrimitive.Root>>
}) {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={cn('grid gap-2', className)}
      {...props}
    />
  )
})

const RadioGroupItem = memo(function RadioGroupItem({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
  ref?: Ref<ComponentRef<typeof RadioGroupPrimitive.Item>>
}) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'border-primary text-primary focus-visible:ring-ring aspect-square h-4 w-4 rounded-full border shadow focus:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})

export { RadioGroup, RadioGroupItem }
