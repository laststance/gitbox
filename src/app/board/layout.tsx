/**
 * Board Layout
 *
 * Layout for /board/* routes
 * - Sidebar navigation
 * - Reads JWT claims (~5ms WebCrypto verify via `requireClaims`) for header
 *   user info, so `loading.tsx` Skeleton can stream effectively immediately
 *   after the first byte instead of waiting on the ~50ms `auth.getUser()`
 *   GoTrue round-trip.
 */

import { requireClaims } from '@/lib/auth/require-claims'
import { getClaimsDisplayInfo } from '@/lib/utils/get-claims-display-info'

import { BoardLayoutClient } from './BoardLayoutClient'

export default async function BoardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { claims } = await requireClaims()
  const { userName, userAvatar } = getClaimsDisplayInfo(claims)

  return (
    <BoardLayoutClient userName={userName} userAvatar={userAvatar}>
      {children}
    </BoardLayoutClient>
  )
}
