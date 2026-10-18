/**
 * Settings Layout
 *
 * Same sidebar chrome as `/account` and `/boards`. The sidebar and the
 * page are siblings so a sidebar that lies over the page can set `inert`
 * on `main`.
 */

import { requireClaims } from '@/lib/auth/require-claims'
import { getClaimsDisplayInfo } from '@/lib/utils/get-claims-display-info'

import { SettingsLayoutClient } from './SettingsLayoutClient'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { claims } = await requireClaims()
  const { userName, userAvatar } = getClaimsDisplayInfo(claims)

  return (
    <SettingsLayoutClient userName={userName} userAvatar={userAvatar}>
      {children}
    </SettingsLayoutClient>
  )
}
