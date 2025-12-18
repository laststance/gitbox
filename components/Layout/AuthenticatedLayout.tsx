'use client'

import React, { memo } from 'react'

import { Sidebar } from '@/components/Sidebar'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
  userName?: string
  userAvatar?: string
}

/**
 * Authenticated Layout Component
 *
 * Layout for authenticated users
 * - Sidebar navigation
 * - Main content area
 */
export const AuthenticatedLayout = memo(function AuthenticatedLayout({
  children,
  userName,
  userAvatar,
}: AuthenticatedLayoutProps) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar userName={userName} userAvatar={userAvatar} />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
})

export default AuthenticatedLayout
