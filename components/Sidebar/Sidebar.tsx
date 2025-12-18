/**
 * Sidebar Component
 *
 * PRD 5.1: 全画面共通のナビゲーションサイドバー
 *
 * Sections:
 * - GitBox ロゴ
 * - Boards (All Boards, Favorites)
 * - Maintenance Mode
 * - Settings
 * - Shortcuts
 * - Profile & Sign out
 */

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
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useState, memo, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/actions/auth'

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
}

/**
 * ナビゲーションアイテム
 */
const NavItem = memo(function NavItem({
  href,
  icon,
  label,
  isActive,
}: NavItemProps) {
  const linkClassName = useMemo(
    () => `${NAV_ITEM_BASE} ${isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE}`,
    [isActive],
  )

  return (
    <Link href={href} className={linkClassName}>
      {icon}
      <span>{label}</span>
    </Link>
  )
})

interface SidebarProps {
  userName?: string
  userAvatar?: string
}

export const Sidebar = memo(function Sidebar({
  userName = 'User',
  userAvatar,
}: SidebarProps) {
  const pathname = usePathname()
  const [boardsExpanded, setBoardsExpanded] = useState(true)

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <Github className="h-6 w-6 text-sidebar-primary" />
        <span className="text-lg font-semibold">GitBox</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Boards Section */}
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
              />
              <NavItem
                href="/boards/favorites"
                icon={<Star className="h-4 w-4" />}
                label="Favorites"
                isActive={pathname === '/boards/favorites'}
              />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-sidebar-border" />

        {/* Maintenance Mode */}
        <NavItem
          href="/maintenance"
          icon={<Archive className="h-4 w-4" />}
          label="Maintenance Mode"
          isActive={
            pathname === '/maintenance' || pathname.startsWith('/maintenance/')
          }
        />

        {/* Divider */}
        <div className="my-4 border-t border-sidebar-border" />

        {/* Settings */}
        <NavItem
          href="/settings"
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          isActive={pathname === '/settings'}
        />

        {/* Shortcuts */}
        <NavItem
          href="#"
          icon={<Keyboard className="h-4 w-4" />}
          label="Shortcuts"
          isActive={false}
        />
      </nav>

      {/* Profile & Sign out */}
      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
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
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="mt-2 w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
})

export default Sidebar
