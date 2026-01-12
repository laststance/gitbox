/**
 * ThemeToggle Component
 *
 * A dropdown menu for selecting the application theme.
 * Displays Sun/Moon icon based on current theme type.
 * Groups themes into: System, Light Themes, Dark Themes.
 *
 * Used in Sidebar for global theme access.
 * Supports collapsed sidebar mode with icon-only display.
 */

'use client'

import { Sun, Moon, Monitor, Check, Palette } from 'lucide-react'
import { memo, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  type ThemeType,
  LIGHT_THEME_IDS,
  DARK_THEME_IDS,
  THEME_INFO,
  isDarkTheme,
} from '@/lib/constants/themes'
import { useTheme } from '@/lib/hooks/use-theme'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  /** Whether the sidebar is collapsed (icon-only mode) */
  isCollapsed?: boolean
}

/**
 * ThemeToggle Component
 *
 * A compact dropdown for theme selection, designed for sidebar use.
 * Shows current theme indicator (Sun/Moon) and provides full theme selection.
 * Supports collapsed mode with icon-only button and tooltip.
 *
 * @param isCollapsed - When true, displays icon-only with tooltip
 */
export const ThemeToggle = memo(function ThemeToggle({
  isCollapsed = false,
}: ThemeToggleProps) {
  const { theme, setTheme, mounted } = useTheme()

  /**
   * Determines the icon to display based on current theme.
   * - system: Monitor icon
   * - dark themes: Moon icon
   * - light themes: Sun icon
   */
  const ThemeIcon = useMemo(() => {
    if (theme === 'system') return Monitor
    if (isDarkTheme(theme)) return Moon
    return Sun
  }, [theme])

  /**
   * Get display name for current theme.
   */
  const currentThemeName = useMemo(() => {
    return THEME_INFO[theme]?.name ?? 'Theme'
  }, [theme])

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size={isCollapsed ? 'icon' : 'sm'}
        className={cn(
          'text-muted-foreground',
          isCollapsed ? 'h-8 w-full' : 'w-full justify-start gap-2',
        )}
        disabled
      >
        <Palette className="h-4 w-4" />
        {!isCollapsed && <span>Theme</span>}
      </Button>
    )
  }

  // Trigger button - different styles based on collapsed state
  const triggerButton = (
    <Button
      variant="ghost"
      size={isCollapsed ? 'icon' : 'sm'}
      className={cn(
        'text-muted-foreground hover:text-foreground',
        isCollapsed ? 'h-8 w-full' : 'w-full justify-start gap-2',
      )}
    >
      <ThemeIcon className="h-4 w-4" />
      {!isCollapsed && (
        <>
          <span className="flex-1 text-left">Theme</span>
          <span className="text-xs text-muted-foreground/70">
            {currentThemeName}
          </span>
        </>
      )}
    </Button>
  )

  // Dropdown menu content (shared between both modes)
  const menuContent = (
    <DropdownMenuContent
      side="right"
      align="start"
      className="w-56"
      sideOffset={8}
    >
      {/* System Theme */}
      <DropdownMenuLabel className="flex items-center gap-2">
        <Monitor className="h-4 w-4" />
        System
      </DropdownMenuLabel>
      <ThemeMenuItem
        themeId="system"
        currentTheme={theme}
        onSelect={() => setTheme('system')}
      />

      <DropdownMenuSeparator />

      {/* Light Themes */}
      <DropdownMenuLabel className="flex items-center gap-2">
        <Sun className="h-4 w-4" />
        Light
      </DropdownMenuLabel>
      {LIGHT_THEME_IDS.map((themeId) => (
        <ThemeMenuItem
          key={themeId}
          themeId={themeId}
          currentTheme={theme}
          onSelect={() => setTheme(themeId)}
        />
      ))}

      <DropdownMenuSeparator />

      {/* Dark Themes */}
      <DropdownMenuLabel className="flex items-center gap-2">
        <Moon className="h-4 w-4" />
        Dark
      </DropdownMenuLabel>
      {DARK_THEME_IDS.map((themeId) => (
        <ThemeMenuItem
          key={themeId}
          themeId={themeId}
          currentTheme={theme}
          onSelect={() => setTheme(themeId)}
        />
      ))}
    </DropdownMenuContent>
  )

  // Collapsed mode: wrap trigger with tooltip
  if (isCollapsed) {
    return (
      <DropdownMenu>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">
            Theme: {currentThemeName}
          </TooltipContent>
        </Tooltip>
        {menuContent}
      </DropdownMenu>
    )
  }

  // Expanded mode: standard dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      {menuContent}
    </DropdownMenu>
  )
})

/**
 * Individual theme menu item with color indicator and check mark.
 */
interface ThemeMenuItemProps {
  themeId: ThemeType
  currentTheme: ThemeType
  onSelect: () => void
}

const ThemeMenuItem = memo(function ThemeMenuItem({
  themeId,
  currentTheme,
  onSelect,
}: ThemeMenuItemProps) {
  const info = THEME_INFO[themeId]
  const isSelected = currentTheme === themeId

  return (
    <DropdownMenuItem
      onClick={onSelect}
      className="flex cursor-pointer items-center gap-2"
    >
      {/* Color swatch */}
      {themeId === 'system' ? (
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-muted">
          <Monitor className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
      ) : (
        <div
          className={`h-4 w-4 rounded-full shadow-sm ${info?.needsBorder ? 'border border-border' : ''}`}
          style={{ backgroundColor: info?.color }}
        />
      )}
      {/* Theme name */}
      <span className="flex-1">{info?.name}</span>
      {/* Check mark for selected theme */}
      {isSelected && <Check className="h-4 w-4 text-primary" />}
    </DropdownMenuItem>
  )
})
