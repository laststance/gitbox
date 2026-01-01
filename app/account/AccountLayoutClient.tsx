/**
 * Account Layout Client Component
 *
 * Client wrapper for Sidebar and content
 */

'use client'

import React, { memo } from 'react'

import { Sidebar } from '@/components/Sidebar'

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
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar userName={userName} userAvatar={userAvatar} />

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  )
})

export default AccountLayoutClient
