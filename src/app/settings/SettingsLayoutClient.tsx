'use client'

import React, { memo } from 'react'

import { Sidebar } from '@/components/Sidebar'
import { ThemeApplicator } from '@/components/ThemeApplicator'
import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'

interface SettingsLayoutClientProps {
  children: React.ReactNode
  userName?: string
  userAvatar?: string
}

/**
 * Settings layout chrome: sidebar beside the page.
 *
 * Copied from {@link AccountLayoutClient} so `/settings` is a sibling of
 * the sidebar. A sidebar that lies over the page can then set `inert` on
 * `main`. {@link areServerRenderedPropsEqual} keeps the client tree when
 * the server sends the layout again.
 */
export const SettingsLayoutClient = memo(function SettingsLayoutClient({
  children,
  userName,
  userAvatar,
}: SettingsLayoutClientProps) {
  return (
    <>
      <ThemeApplicator />
      <div className="flex h-screen">
        <Sidebar userName={userName} userAvatar={userAvatar} />
        <main className="bg-background flex-1 overflow-auto">{children}</main>
      </div>
    </>
  )
}, areServerRenderedPropsEqual)
