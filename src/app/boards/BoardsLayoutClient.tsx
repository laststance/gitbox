/**
 * Boards Layout Client Component
 *
 * Client wrapper for Sidebar and content
 * Applies theme for authenticated users
 */

'use client'

import React, { memo } from 'react'

import { Sidebar } from '@/components/Sidebar'
import { ThemeApplicator } from '@/components/ThemeApplicator'

interface BoardsLayoutClientProps {
  children: React.ReactNode
  userName?: string
  userAvatar?: string
}

export const BoardsLayoutClient = memo(function BoardsLayoutClient({
  children,
  userName,
  userAvatar,
}: BoardsLayoutClientProps) {
  return (
    <>
      <ThemeApplicator />
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar userName={userName} userAvatar={userAvatar} />

        {/* Main Content */}
        <main className="bg-background flex-1 overflow-auto">{children}</main>
      </div>
    </>
  )
})
