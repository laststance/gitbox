'use client'

/**
 * Shared Service Page Layout Component
 *
 * Design Philosophy:
 * - Consistent header across all Google services
 * - App launcher integration for navigation
 * - Email count badge to show persistence status
 * - Clean, distinctive design per service
 *
 * Purpose:
 * This layout enables testing that localStorage persists
 * the Gmail state when navigating to other services.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Grid3X3, Mail, ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AppLauncher from '@/components/gmail/AppLauncher'
import { useAppSelector } from '@/lib/hooks'

interface ServicePageLayoutProps {
  serviceName: string
  serviceIcon: React.ReactNode
  serviceColor: string
  children: React.ReactNode
}

/**
 * Shared layout for all service pages
 *
 * Features:
 * - Gmail email count badge (shows persistence)
 * - App launcher for navigation
 * - Back to Gmail button
 * - Service-specific header styling
 */
function ServicePageLayout({
  serviceName,
  serviceIcon,
  serviceColor,
  children,
}: ServicePageLayoutProps) {
  const emailCount = useAppSelector((state) => state.emails.emails.length)
  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(false)
  const appLauncherRef = useRef<HTMLDivElement>(null)

  // Close app launcher when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        appLauncherRef.current &&
        !appLauncherRef.current.contains(event.target as Node)
      ) {
        setIsAppLauncherOpen(false)
      }
    }
    if (isAppLauncherOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isAppLauncherOpen])

  const toggleAppLauncher = useCallback(() => {
    setIsAppLauncherOpen((prev) => !prev)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Service Header */}
      <header
        className="flex items-center gap-4 px-6 py-4 border-b border-gray-800"
        style={{
          background: `linear-gradient(90deg, ${serviceColor}15 0%, transparent 50%)`,
        }}
      >
        {/* Back to Gmail */}
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Gmail</span>
          </Button>
        </Link>

        {/* Service Logo */}
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl"
            style={{ backgroundColor: `${serviceColor}20` }}
          >
            {serviceIcon}
          </div>
          <span className="text-xl font-medium text-white">{serviceName}</span>
          <Badge
            variant="secondary"
            className="text-xs bg-gray-800 text-gray-400"
          >
            Demo
          </Badge>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Gmail Status Badge */}
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
          data-testid="gmail-status-badge"
        >
          <Mail className="h-4 w-4 text-red-400" />
          <span className="text-sm text-gray-300">
            {emailCount > 0 ? (
              <>
                <span className="font-semibold text-white">
                  {emailCount.toLocaleString()}
                </span>
                {' emails persisted'}
              </>
            ) : (
              'No emails yet'
            )}
          </span>
        </Link>

        {/* App Launcher */}
        <div className="relative" ref={appLauncherRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleAppLauncher}
            className={`text-gray-400 hover:text-white ${isAppLauncherOpen ? 'bg-gray-800' : ''}`}
            aria-label="Google apps"
            data-testid="app-launcher-button"
          >
            <Grid3X3 className="h-5 w-5" />
          </Button>

          {isAppLauncherOpen && (
            <AppLauncher onClose={() => setIsAppLauncherOpen(false)} />
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="px-6 py-3 border-t border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            redux-storage-middleware demo | Navigate between services to test
            persistence
          </span>
          <span>
            Gmail emails:{' '}
            {emailCount > 0 ? `${emailCount.toLocaleString()} ✅` : 'None'}
          </span>
        </div>
      </footer>
    </div>
  )
}

export default memo(ServicePageLayout)
