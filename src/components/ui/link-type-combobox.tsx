'use client'

/**
 * Link Type Combobox Component
 *
 * A searchable dropdown for selecting link types from:
 * - 55 built-in presets (grouped by category)
 * - User-defined custom presets
 *
 * Uses shadcn/ui Combobox pattern (Popover + Command).
 *
 * @see lib/constants/link-presets.ts for available presets
 * @see lib/actions/user-presets.ts for custom preset CRUD
 */

import {
  Check,
  ChevronsUpDown,
  Plus,
  Link as LinkIcon,
  type LucideIcon,
} from 'lucide-react'
import * as icons from 'lucide-react'
import {
  memo,
  useState,
  useMemo,
  useCallback,
  createElement,
  useRef,
} from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  LINK_TYPE_CATEGORIES,
  getPresetsByCategory,
  findPresetByValue,
} from '@/lib/constants/link-presets'
import { cn } from '@/lib/utils'

/**
 * User preset data (from user_link_presets table)
 */
export interface UserPresetOption {
  id: string
  value: string
  label: string
  icon: string
}

interface LinkTypeComboboxProps {
  /** Currently selected value */
  value: string
  /** Callback when value changes */
  onValueChange: (value: string) => void
  /** User-defined custom presets */
  userPresets?: UserPresetOption[]
  /** Callback when "Add Custom" is clicked */
  onAddCustomClick?: () => void
  /** Optional className for the trigger button */
  className?: string
  /** Disable the combobox */
  disabled?: boolean
}

/**
 * Get icon component from lucide-react by name
 *
 * @param iconName - Name of the icon (PascalCase)
 * @returns LucideIcon component or LinkIcon as fallback
 */
function getIconComponent(iconName: string): LucideIcon {
  const IconComponent = (icons as unknown as Record<string, LucideIcon>)[
    iconName
  ]
  return IconComponent || LinkIcon
}

/**
 * Render an icon by name with fallback
 *
 * Uses createElement to dynamically render icons from lucide-react.
 * The icon component is looked up from the icons object at runtime.
 */
const IconRenderer = memo(function IconRenderer({
  iconName,
  className,
}: {
  iconName: string
  className?: string
}) {
  const IconComponent = getIconComponent(iconName)
  // Use createElement to avoid ESLint static-components rule
  return createElement(IconComponent, { className })
})

/**
 * Get display label for a value
 *
 * @param value - The value to look up
 * @param userPresets - User-defined presets to check
 * @returns Display label or the value itself if not found
 */
function getDisplayLabel(
  value: string,
  userPresets: UserPresetOption[] = [],
): string {
  // Check built-in presets
  const builtIn = findPresetByValue(value)
  if (builtIn) return builtIn.label

  // Check user presets
  const userPreset = userPresets.find((p) => p.value === value)
  if (userPreset) return userPreset.label

  // Fallback: convert kebab-case to Title Case
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Get icon name for a value
 *
 * @param value - The value to look up
 * @param userPresets - User-defined presets to check
 * @returns Icon name or 'Link' as default
 */
function getIconName(
  value: string,
  userPresets: UserPresetOption[] = [],
): string {
  // Check built-in presets
  const builtIn = findPresetByValue(value)
  if (builtIn) return builtIn.icon

  // Check user presets
  const userPreset = userPresets.find((p) => p.value === value)
  if (userPreset) return userPreset.icon

  return 'Link'
}

/**
 * Link Type Combobox
 *
 * Searchable dropdown for selecting link types with categories and custom presets.
 *
 * @example
 * <LinkTypeCombobox
 *   value={link.type}
 *   onValueChange={(type) => handleTypeChange(index, type)}
 *   userPresets={userPresets}
 *   onAddCustomClick={() => setShowCreateDialog(true)}
 * />
 */
export const LinkTypeCombobox = memo(function LinkTypeCombobox({
  value,
  onValueChange,
  userPresets = [],
  onAddCustomClick,
  className,
  disabled = false,
}: LinkTypeComboboxProps) {
  const [open, setOpen] = useState(false)

  // Memoize grouped presets
  const presetsByCategory = useMemo(() => getPresetsByCategory(), [])

  // Get current selection display
  const displayLabel = useMemo(
    () => getDisplayLabel(value, userPresets),
    [value, userPresets],
  )
  const iconName = useMemo(
    () => getIconName(value, userPresets),
    [value, userPresets],
  )

  const handleSelect = useCallback(
    (selectedValue: string) => {
      onValueChange(selectedValue)
      setOpen(false)
    },
    [onValueChange],
  )

  // Ref for CommandList to enable manual scroll
  const listRef = useRef<HTMLDivElement>(null)

  /**
   * Handle wheel events on CommandList
   *
   * cmdk library prevents default wheel events for keyboard navigation.
   * This handler manually scrolls the list to restore mouse/trackpad scrolling.
   */
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (listRef.current) {
      listRef.current.scrollBy(0, e.deltaY)
    }
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls="link-type-combobox-list"
          aria-label="Select link type"
          className={cn('w-[180px] justify-between', className)}
          disabled={disabled}
          data-testid="link-type-combobox-trigger"
        >
          <span className="flex items-center gap-2 truncate">
            <IconRenderer iconName={iconName} className="h-4 w-4 shrink-0" />
            <span className="truncate">{displayLabel}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search link types..." />

          {/* Fixed Header: Add Custom Type (always visible) */}
          {onAddCustomClick && (
            <button
              type="button"
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex w-full items-center gap-2 border-b px-3 py-2 text-sm transition-colors focus:outline-none"
              onClick={() => {
                setOpen(false)
                onAddCustomClick()
              }}
              data-testid="add-custom-link-type"
            >
              <Plus className="h-4 w-4" />
              <span>Add custom type...</span>
            </button>
          )}

          <CommandList
            id="link-type-combobox-list"
            ref={listRef}
            onWheel={handleWheel}
            className="max-h-[300px]"
          >
            <CommandEmpty>No link type found.</CommandEmpty>

            {/* User Custom Presets (if any) */}
            {userPresets.length > 0 && (
              <>
                <CommandGroup heading="Custom">
                  {userPresets.map((preset) => (
                    <CommandItem
                      key={preset.id}
                      value={preset.value}
                      onSelect={handleSelect}
                      data-testid={`link-type-option-${preset.value}`}
                    >
                      <IconRenderer
                        iconName={preset.icon}
                        className="mr-2 h-4 w-4"
                      />
                      <span>{preset.label}</span>
                      {value === preset.value && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Built-in Presets by Category */}
            {LINK_TYPE_CATEGORIES.filter((cat) => cat !== 'Custom').map(
              (category) => {
                const presets = presetsByCategory[category]
                if (!presets || presets.length === 0) return null

                return (
                  <CommandGroup key={category} heading={category}>
                    {presets.map((preset) => (
                      <CommandItem
                        key={preset.value}
                        value={preset.value}
                        onSelect={handleSelect}
                        data-testid={`link-type-option-${preset.value}`}
                      >
                        <IconRenderer
                          iconName={preset.icon}
                          className="mr-2 h-4 w-4"
                        />
                        <span>{preset.label}</span>
                        {value === preset.value && (
                          <Check className="ml-auto h-4 w-4" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              },
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
})
