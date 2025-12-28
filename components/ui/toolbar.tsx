/**
 * Toolbar Component
 *
 * Provides toolbar functionality using Radix UI primitives.
 * Used for editor toolbars with grouped buttons and toggles.
 */

'use client'

import * as ToolbarPrimitive from '@radix-ui/react-toolbar'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Toolbar Root
 *
 * Container for toolbar items. Provides keyboard navigation.
 */
const Toolbar = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Root
    ref={ref}
    className={cn(
      'flex items-center gap-1 rounded-md border bg-background p-1',
      className,
    )}
    {...props}
  />
))
Toolbar.displayName = ToolbarPrimitive.Root.displayName

/**
 * Toolbar Button
 *
 * A button within the toolbar. Supports active/inactive states.
 */
const ToolbarButton = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.Button>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Button
    ref={ref}
    className={cn(
      'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium',
      'ring-offset-background transition-colors',
      'hover:bg-muted hover:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
ToolbarButton.displayName = ToolbarPrimitive.Button.displayName

/**
 * Toolbar Toggle Item
 *
 * A toggle button for formatting options (bold, italic, etc.)
 */
const ToolbarToggleItem = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.ToggleItem>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleItem>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.ToggleItem
    ref={ref}
    className={cn(
      'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium',
      'ring-offset-background transition-colors',
      'hover:bg-muted hover:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
      className,
    )}
    {...props}
  />
))
ToolbarToggleItem.displayName = ToolbarPrimitive.ToggleItem.displayName

/**
 * Toolbar Toggle Group
 *
 * Groups related toggle items together.
 */
const ToolbarToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.ToggleGroup>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleGroup>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.ToggleGroup
    ref={ref}
    className={cn('flex items-center gap-0.5', className)}
    {...props}
  />
))
ToolbarToggleGroup.displayName = ToolbarPrimitive.ToggleGroup.displayName

/**
 * Toolbar Separator
 *
 * Visual separator between toolbar groups.
 */
const ToolbarSeparator = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Separator
    ref={ref}
    className={cn('mx-1 h-5 w-px bg-border', className)}
    {...props}
  />
))
ToolbarSeparator.displayName = ToolbarPrimitive.Separator.displayName

export {
  Toolbar,
  ToolbarButton,
  ToolbarToggleItem,
  ToolbarToggleGroup,
  ToolbarSeparator,
}
