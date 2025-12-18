/**
 * Boards Layout Client Component
 *
 * Client wrapper for Sidebar and content
 */

'use client'

import React from 'react'
import { Sidebar } from '@/components/Sidebar'

interface BoardsLayoutClientProps {
  children: React.ReactNode
  userName?: string
  userAvatar?: string
}

export const BoardsLayoutClient: React.FC<BoardsLayoutClientProps> = ({
  children,
  userName,
  userAvatar,
}) => {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar userName={userName} userAvatar={userAvatar} />

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  )
}

export default BoardsLayoutClient
