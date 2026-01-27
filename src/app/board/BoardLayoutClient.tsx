/**
 * Board Layout Client Component
 *
 * Client wrapper for Sidebar and content
 * Applies theme for authenticated users
 */

'use client'

import React, { memo } from 'react'

import { Sidebar } from '@/components/Sidebar'
import { ThemeApplicator } from '@/components/ThemeApplicator'

interface BoardLayoutClientProps {
  children: React.ReactNode
  userName?: string
  userAvatar?: string
}

export const BoardLayoutClient = memo(function BoardLayoutClient({
  children,
  userName,
  userAvatar,
}: BoardLayoutClientProps) {
  return (
    <>
      <ThemeApplicator />
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar userName={userName} userAvatar={userAvatar} />

        {/* Main Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </>
  )
})
