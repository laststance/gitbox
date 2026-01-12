'use client'

import {
  type ResizeHandle as ResizeHandlePrimitive,
  useResizeHandle,
  useResizeHandleState,
} from '@platejs/resizable'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const resizeHandleVariants = cva('absolute z-40', {
  variants: {
    direction: {
      bottom: 'w-full cursor-row-resize',
      left: 'h-full cursor-col-resize',
      right: 'h-full cursor-col-resize',
      top: 'w-full cursor-row-resize',
    },
  },
})

export function ResizeHandle({
  className,
  options,
  ...props
}: React.ComponentProps<typeof ResizeHandlePrimitive> &
  VariantProps<typeof resizeHandleVariants>) {
  const state = useResizeHandleState(options ?? {})
  const resizeHandle = useResizeHandle(state)

  if (state.readOnly) return null

  return (
    <div
      className={cn(
        resizeHandleVariants({ direction: options?.direction }),
        className,
      )}
      data-resizing={state.isResizing}
      {...resizeHandle.props}
      {...props}
    />
  )
}
