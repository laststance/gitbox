'use client'

import {
  LayoutDashboard,
  Star,
  Settings,
  Keyboard,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useState, memo, useEffect, useMemo, useRef } from 'react'

import { GithubIcon } from '@/components/icons/GithubIcon'
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
import { forgetAccountOnThisBrowser } from '@/lib/redux/forget-account-on-this-browser'
import { store } from '@/lib/redux/store'
import { cn } from '@/lib/utils'

const ICON_LAYOUT_DASHBOARD = <LayoutDashboard className="h-4 w-4" />
const ICON_STAR = <Star className="h-4 w-4" />
const ICON_SETTINGS = <Settings className="h-4 w-4" />
const ICON_KEYBOARD = <Keyboard className="h-4 w-4" />

/** Base styles for navigation item */
const NAV_ITEM_BASE =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors'
// The page the user is on: a tint of the theme's primary under a label in
// the sidebar's own text color. The label was text-primary, which on that
// tint is below 4.5:1 in 11 of the 14 themes (2.7:1 on Plum): the themes
// change the primary and leave the sidebar neutral. Checked in
// sidebar-label-contrast.test.ts.
const NAV_ITEM_ACTIVE = 'bg-primary/10 text-sidebar-foreground'
const NAV_ITEM_INACTIVE =
  'text-muted-foreground hover:bg-accent hover:text-accent-foreground'

interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  isActive: boolean
  isCollapsed?: boolean
  /** Called when the link is chosen, before the page changes. */
  onNavigate?: () => void
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
  onNavigate,
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
    <Link
      href={href}
      className={linkClassName}
      onClick={onNavigate}
      // The rail shows the icon alone: the name the label gave is kept
      aria-label={isCollapsed ? label : undefined}
      // Color alone marks the page the user is on
      aria-current={isActive ? 'page' : undefined}
    >
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
    <button
      type="button"
      onClick={onClick}
      className={buttonClassName}
      aria-label={isCollapsed ? label : undefined}
    >
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
  /** The button element, so the keyboard focus can be put on it. */
  ref?: React.Ref<HTMLButtonElement>
}

/**
 * Toggle button for sidebar collapse/expand
 */
const SidebarToggleButton = memo(function SidebarToggleButton({
  isCollapsed,
  onToggle,
  ref,
}: SidebarToggleButtonProps) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          variant="ghost"
          size="icon"
          onClick={onToggle}
          // pointer-coarse: on a touch screen this button is the way to the
          // labels, so it gets a finger-sized target
          className="h-8 w-8 shrink-0 pointer-coarse:h-11 pointer-coarse:w-11"
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
 * - Settings and Shortcuts links
 * - Theme toggle
 * - User profile with sign out option
 * - Collapse/expand toggle with state persistence via Redux
 * - Below 768px the icon rail: the open sidebar (256px) leaves a phone 119px
 *   for the page. The toggle opens it over the page there, with its labels,
 *   until a link, the page behind it or Escape closes it. A touch screen
 *   shows no tooltip, so that is where the icons get their names. While it
 *   lies over the page, the page is out of reach as it is under a dialog.
 */
export const Sidebar = memo(function Sidebar({
  userName = 'User',
  userAvatar,
}: SidebarProps) {
  const pathname = usePathname()
  const [boardsExpanded, setBoardsExpanded] = useState(true)
  const { isCollapsed, isOverPage, toggle, closeOverPage, mounted } =
    useSidebar()
  // The toggle button, one element for both layouts
  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  // The sidebar's place in the row of the page: what stands beside it there
  // is the page
  const placeRef = useRef<HTMLDivElement>(null)

  // While the sidebar lies over the page, the page is out of reach: the
  // keyboard and a screen reader stay in the sidebar, and Escape closes it
  // wherever the focus is
  useEffect(() => {
    const place = placeRef.current
    if (!isOverPage || !place?.parentElement) return

    const pageParts = Array.from(place.parentElement.children).filter(
      (element) => element !== place && !element.hasAttribute('inert'),
    )
    pageParts.forEach((pagePart) => pagePart.setAttribute('inert', ''))

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      // A menu of the sidebar (the theme list) is drawn outside of it and
      // closes itself on Escape: that key press is not for the sidebar
      const isInAnotherLayer =
        event.target instanceof Node &&
        event.target !== document.body &&
        !place.contains(event.target)
      if (isInAnotherLayer) return
      closeOverPage()
      toggleButtonRef.current?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)

    return (): void => {
      pageParts.forEach((pagePart) => pagePart.removeAttribute('inert'))
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOverPage, closeOverPage])

  const handleSignOut = async (): Promise<void> => {
    // The write lands before the redirect, which would cancel a save still waiting
    await forgetAccountOnThisBrowser(store)
    await signOut()
  }

  const handleOpenShortcuts = (): void => {
    closeOverPage()
    openShortcutsHelp()
  }

  // The icon rail. SSR always renders the expanded sidebar, for stable
  // hydration; the client applies the stored state once it has mounted.
  const isRail = mounted && isCollapsed
  // The toggle stands in a row of its own under the logo: as the rail, and
  // in the sidebar that lies over the page, so the button is still under the
  // finger that opened the sidebar and a second press closes it
  const hasToggleRow = isRail || isOverPage

  // Determine sidebar width class
  // max-md: the rail's width from the first paint on a phone, before the
  // client has swapped the labels for icons. Not while it is open over the
  // page: then it has its full width.
  const sidebarWidth = cn(
    isRail ? 'w-16' : 'w-64',
    !isOverPage && 'max-md:w-16',
  )

  return (
    <TooltipProvider>
      {/* The sidebar's place in the row of the page. From 768px it is the
          sidebar itself (md:contents). Below, the sidebar is fixed to the
          left edge and this keeps the 64px of the rail: the page starts
          beside the rail and does not move when the sidebar opens over it */}
      <div
        ref={placeRef}
        data-testid="sidebar-place"
        className="max-md:w-16 max-md:shrink-0 md:contents"
      >
        {/* The page behind the opened sidebar: pressing it closes the sidebar */}
        {isOverPage && (
          <div
            data-testid="sidebar-backdrop"
            aria-hidden="true"
            onClick={closeOverPage}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
          />
        )}
        <aside
          suppressHydrationWarning
          className={cn(
            'border-border bg-sidebar text-sidebar-foreground flex h-screen flex-col border-r',
            // The width is animated: what does not fit yet is cut off at the
            // edge, and no label wraps onto a second line on the way
            'overflow-hidden whitespace-nowrap',
            // Below 768px over the page, not beside it: as the rail it covers
            // its place, opened it covers the left of the page. h-auto: its
            // height is what lies between top and bottom of the screen that
            // is in view. 100vh is more than that while a phone shows its
            // browser bars, and the account link and Sign Out were below it.
            'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:h-auto',
            isOverPage ? 'max-md:z-50 max-md:shadow-xl' : 'max-md:z-30',
            'transition-[width] duration-300 ease-out md:transition-none',
            sidebarWidth,
          )}
        >
          {/* Logo + Toggle. The toggle is one element in every layout, at
              the same place in this block each time, so React keeps it and
              the keyboard focus stays on it when the sidebar collapses or
              expands. With a row of its own the block is a column: the logo,
              a divider, and the button in a cell as wide as the rail. Logo
              and button are then at the same place in the rail and in the
              sidebar that opens over the page: nothing jumps while the width
              grows, and the button never leaves the part that is in view.
              From 768px the expanded sidebar has the button beside the name. */}
          <div
            suppressHydrationWarning
            className={cn(
              'border-sidebar-border flex border-b px-2 pt-4',
              hasToggleRow
                ? 'flex-col items-start pb-2'
                : 'items-center justify-between pb-4',
            )}
          >
            {/* pl-3: the logo at the middle of the rail's 64px, name or no
                name. leading-6: the name is as high as the logo, so the row
                of the button does not move down when the name appears. */}
            <div
              className={cn('flex items-center gap-2', hasToggleRow && 'pl-3')}
            >
              <GithubIcon className="text-sidebar-primary h-6 w-6 shrink-0" />
              {!isRail && (
                <span
                  className={cn(
                    'text-lg font-semibold',
                    hasToggleRow && 'leading-6',
                  )}
                >
                  GitBox
                </span>
              )}
            </div>
            {mounted && (
              <div
                className={cn(
                  hasToggleRow &&
                    'border-sidebar-border -mx-2 mt-4 self-stretch border-t pt-2',
                )}
              >
                <div className={cn(hasToggleRow && 'flex w-16 justify-center')}>
                  <SidebarToggleButton
                    ref={toggleButtonRef}
                    isCollapsed={isCollapsed}
                    onToggle={toggle}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav
            suppressHydrationWarning
            className={cn(
              'flex-1 overflow-x-hidden overflow-y-auto py-4',
              isRail ? 'px-2' : 'px-3',
            )}
          >
            {/* Boards Section - collapsible header only when expanded */}
            {/* SSR: Always render expanded content for stable hydration */}
            {!isRail && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setBoardsExpanded(!boardsExpanded)}
                  className="text-sidebar-foreground hover:bg-sidebar-accent flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold"
                  // The chevron alone says whether the links below are shown
                  aria-expanded={boardsExpanded}
                >
                  <span>Boards</span>
                  {boardsExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {boardsExpanded && (
                  <div className="mt-1 ml-2 space-y-1">
                    <NavItem
                      href="/boards"
                      icon={ICON_LAYOUT_DASHBOARD}
                      label="All Boards"
                      isActive={pathname === '/boards'}
                      isCollapsed={isRail}
                      onNavigate={closeOverPage}
                    />
                    <NavItem
                      href="/boards/favorites"
                      icon={ICON_STAR}
                      label="Favorites"
                      isActive={pathname === '/boards/favorites'}
                      isCollapsed={isRail}
                      onNavigate={closeOverPage}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Boards Section - flat icons when collapsed */}
            {/* Only render collapsed content after hydration completes */}
            {isRail && (
              <div className="mb-4 space-y-1">
                <NavItem
                  href="/boards"
                  icon={ICON_LAYOUT_DASHBOARD}
                  label="All Boards"
                  isActive={pathname === '/boards'}
                  isCollapsed={isRail}
                />
                <NavItem
                  href="/boards/favorites"
                  icon={ICON_STAR}
                  label="Favorites"
                  isActive={pathname === '/boards/favorites'}
                  isCollapsed={isRail}
                />
              </div>
            )}

            {/* Divider */}
            <div className="border-sidebar-border my-4 border-t" />

            {/* Settings */}
            <NavItem
              href="/settings"
              icon={ICON_SETTINGS}
              label="Settings"
              isActive={pathname === '/settings'}
              isCollapsed={isRail}
              onNavigate={closeOverPage}
            />

            {/* Shortcuts - button that opens ShortcutsHelp modal */}
            <NavButton
              icon={ICON_KEYBOARD}
              label="Shortcuts"
              onClick={handleOpenShortcuts}
              isCollapsed={isRail}
            />

            {/* Theme Toggle. Over the page the list of themes opens below
                the button, inside the sidebar: to the right of it there are
                119px of a 375px screen, and the list is 224px wide. */}
            <ThemeToggle
              isCollapsed={isRail}
              menuSide={isOverPage ? 'bottom' : 'right'}
            />
          </nav>

          {/* Profile & Sign Out */}
          <div
            suppressHydrationWarning
            className={cn(
              'border-sidebar-border border-t py-4',
              isRail ? 'px-2' : 'px-3',
            )}
          >
            {/* Profile Link */}
            {isRail ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    href="/account"
                    className="hover:bg-sidebar-accent flex items-center justify-center rounded-lg py-2 transition-colors"
                    // Without an avatar image nothing else names the link
                    aria-label={userName}
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
                      <div className="bg-sidebar-accent flex h-8 w-8 items-center justify-center rounded-full">
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
                onClick={closeOverPage}
                className="hover:bg-sidebar-accent flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
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
                  <div className="bg-sidebar-accent flex h-8 w-8 items-center justify-center rounded-full">
                    <User className="h-4 w-4" />
                  </div>
                )}
                <div className="flex-1 truncate">
                  <p className="truncate text-sm font-medium">{userName}</p>
                </div>
              </Link>
            )}

            {/* Sign Out Button */}
            {isRail ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSignOut}
                    className="text-muted-foreground hover:text-foreground mt-2 w-full"
                    aria-label="Sign Out"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground mt-2 w-full justify-start gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            )}
          </div>
        </aside>
      </div>
    </TooltipProvider>
  )
})
