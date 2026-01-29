'use client'

import {
  LayoutDashboard,
  Star,
  Archive,
  Settings,
  Keyboard,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Github,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useState, memo, useMemo } from 'react'

import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSidebar } from '@/hooks/use-sidebar'
import { signOut } from '@/lib/actions/auth'
import { openShortcutsHelp } from '@/lib/events'
import { cn } from '@/lib/utils'

/** Base styles for navigation item */
const NAV_ITEM_BASE =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors'
const NAV_ITEM_ACTIVE = 'bg-primary/10 text-primary'
const NAV_ITEM_INACTIVE =
  'text-muted-foreground hover:bg-accent hover:text-accent-foreground'

interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  isActive: boolean
  isCollapsed?: boolean
}

/**
 * Navigation item component with tooltip support for collapsed state
 */
const NavItem = memo(function NavItem({
  href,
  icon,
  label,
  isActive,
  isCollapsed = false,
}: NavItemProps) {
  const linkClassName = useMemo(
    () =>
      cn(
        NAV_ITEM_BASE,
        isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE,
        isCollapsed && 'justify-center px-2',
      ),
    [isActive, isCollapsed],
  )

  const linkContent = (
    <Link href={href} className={linkClassName}>
      {icon}
      {!isCollapsed && <span>{label}</span>}
    </Link>
  )

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return linkContent
})

interface NavButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  isCollapsed?: boolean
}

/**
 * Navigation button component (for non-link items like Shortcuts)
 */
const NavButton = memo(function NavButton({
  icon,
  label,
  onClick,
  isCollapsed = false,
}: NavButtonProps) {
  const buttonClassName = cn(
    NAV_ITEM_BASE,
    NAV_ITEM_INACTIVE,
    'w-full',
    isCollapsed && 'justify-center px-2',
  )

  const buttonContent = (
    <button type="button" onClick={onClick} className={buttonClassName}>
      {icon}
      {!isCollapsed && <span>{label}</span>}
    </button>
  )

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return buttonContent
})

interface SidebarToggleButtonProps {
  isCollapsed: boolean
  onToggle: () => void
}

/**
 * Toggle button for sidebar collapse/expand
 */
const SidebarToggleButton = memo(function SidebarToggleButton({
  isCollapsed,
  onToggle,
}: SidebarToggleButtonProps) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 flex-shrink-0"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      </TooltipContent>
    </Tooltip>
  )
})

interface SidebarProps {
  userName?: string
  userAvatar?: string
}

/**
 * Sidebar Component
 *
 * A collapsible navigation sidebar for authenticated users.
 * - GitBox logo
 * - Boards section (All Boards, Favorites)
 * - Maintenance Mode navigation
 * - Settings and Shortcuts links
 * - Theme toggle
 * - User profile with sign out option
 * - Collapse/expand toggle with state persistence via Redux
 */
export const Sidebar = memo(function Sidebar({
  userName = 'User',
  userAvatar,
}: SidebarProps) {
  const pathname = usePathname()
  const [boardsExpanded, setBoardsExpanded] = useState(true)
  const { isCollapsed, toggle, mounted } = useSidebar()

  const handleSignOut = async () => {
    await signOut()
  }

  // Determine sidebar width class
  // SSR: Always render expanded (w-64) for stable hydration
  // Client: Use persisted collapsed state from Redux/localStorage
  const sidebarWidth = mounted && isCollapsed ? 'w-16' : 'w-64'

  return (
    <TooltipProvider>
      <aside
        suppressHydrationWarning
        className={cn(
          'flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground',
          'transition-[width] duration-300 ease-out',
          sidebarWidth,
        )}
      >
        {/* Logo + Toggle */}
        <div
          suppressHydrationWarning
          className={cn(
            'flex items-center border-b border-sidebar-border px-2 py-4',
            mounted && isCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2',
              mounted && isCollapsed && 'justify-center',
            )}
          >
            <Github className="h-6 w-6 flex-shrink-0 text-sidebar-primary" />
            {(!mounted || !isCollapsed) && (
              <span className="text-lg font-semibold">GitBox</span>
            )}
          </div>
          {mounted && !isCollapsed && (
            <SidebarToggleButton isCollapsed={isCollapsed} onToggle={toggle} />
          )}
        </div>

        {/* Toggle button when collapsed - shown below logo */}
        {isCollapsed && mounted && (
          <div className="flex justify-center border-b border-sidebar-border py-2">
            <SidebarToggleButton isCollapsed={isCollapsed} onToggle={toggle} />
          </div>
        )}

        {/* Navigation */}
        <nav
          suppressHydrationWarning
          className={cn(
            'flex-1 overflow-y-auto py-4',
            mounted && isCollapsed ? 'px-2' : 'px-3',
          )}
        >
          {/* Boards Section - collapsible header only when expanded */}
          {/* SSR: Always render expanded content for stable hydration */}
          {(!mounted || !isCollapsed) && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setBoardsExpanded(!boardsExpanded)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <span>Boards</span>
                {boardsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {boardsExpanded && (
                <div className="ml-2 mt-1 space-y-1">
                  <NavItem
                    href="/boards"
                    icon={<LayoutDashboard className="h-4 w-4" />}
                    label="All Boards"
                    isActive={pathname === '/boards'}
                    isCollapsed={mounted && isCollapsed}
                  />
                  <NavItem
                    href="/boards/favorites"
                    icon={<Star className="h-4 w-4" />}
                    label="Favorites"
                    isActive={pathname === '/boards/favorites'}
                    isCollapsed={mounted && isCollapsed}
                  />
                </div>
              )}
            </div>
          )}

          {/* Boards Section - flat icons when collapsed */}
          {/* Only render collapsed content after hydration completes */}
          {mounted && isCollapsed && (
            <div className="mb-4 space-y-1">
              <NavItem
                href="/boards"
                icon={<LayoutDashboard className="h-4 w-4" />}
                label="All Boards"
                isActive={pathname === '/boards'}
                isCollapsed={mounted && isCollapsed}
              />
              <NavItem
                href="/boards/favorites"
                icon={<Star className="h-4 w-4" />}
                label="Favorites"
                isActive={pathname === '/boards/favorites'}
                isCollapsed={mounted && isCollapsed}
              />
            </div>
          )}

          {/* Divider */}
          <div className="my-4 border-t border-sidebar-border" />

          {/* Maintenance Mode */}
          <NavItem
            href="/maintenance"
            icon={<Archive className="h-4 w-4" />}
            label="Maintenance Mode"
            isActive={
              pathname === '/maintenance' ||
              pathname.startsWith('/maintenance/')
            }
            isCollapsed={mounted && isCollapsed}
          />

          {/* Divider */}
          <div className="my-4 border-t border-sidebar-border" />

          {/* Settings */}
          <NavItem
            href="/settings"
            icon={<Settings className="h-4 w-4" />}
            label="Settings"
            isActive={pathname === '/settings'}
            isCollapsed={mounted && isCollapsed}
          />

          {/* Shortcuts - button that opens ShortcutsHelp modal */}
          <NavButton
            icon={<Keyboard className="h-4 w-4" />}
            label="Shortcuts"
            onClick={openShortcutsHelp}
            isCollapsed={mounted && isCollapsed}
          />

          {/* Theme Toggle */}
          <ThemeToggle isCollapsed={mounted && isCollapsed} />
        </nav>

        {/* Profile & Sign out */}
        <div
          suppressHydrationWarning
          className={cn(
            'border-t border-sidebar-border py-4',
            mounted && isCollapsed ? 'px-2' : 'px-3',
          )}
        >
          {/* Profile Link */}
          {mounted && isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/account"
                  className="flex items-center justify-center rounded-lg py-2 transition-colors hover:bg-sidebar-accent"
                >
                  {userAvatar ? (
                    <Image
                      src={userAvatar}
                      alt={userName}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{userName}</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/account"
              className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-sidebar-accent"
            >
              {userAvatar ? (
                <Image
                  src={userAvatar}
                  alt={userName}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
                  <User className="h-4 w-4" />
                </div>
              )}
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium">{userName}</p>
              </div>
            </Link>
          )}

          {/* Sign Out Button */}
          {mounted && isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="mt-2 w-full text-muted-foreground hover:text-foreground"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="mt-2 w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
})
