/**
 * Account Layout Client Component
 *
 * Client wrapper for Sidebar and content
 * Applies theme for authenticated users
 */

'use client'

import React, { memo } from 'react'

import { Sidebar } from '@/components/Sidebar'
import { ThemeApplicator } from '@/components/ThemeApplicator'

interface AccountLayoutClientProps {
  children: React.ReactNode
  userName?: string
  userAvatar?: string
}

export const AccountLayoutClient = memo(function AccountLayoutClient({
  children,
  userName,
  userAvatar,
}: AccountLayoutClientProps) {
  return (
    <>
      <ThemeApplicator />
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar userName={userName} userAvatar={userAvatar} />

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background">{children}</main>
      </div>
    </>
  )
})
