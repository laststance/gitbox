/**
 * Boards Layout
 *
 * Layout for /boards/* routes
 * - Sidebar navigation
 * - Reads JWT claims (~5ms WebCrypto verify via `requireClaims`) for header
 *   user info, avoiding the ~50ms `auth.getUser()` GoTrue round-trip and
 *   unblocking `loading.tsx` streaming below this layout.
 */

import { requireClaims } from '@/lib/auth/require-claims'
import { getClaimsDisplayInfo } from '@/lib/utils/get-claims-display-info'

import { BoardsLayoutClient } from './BoardsLayoutClient'

export default async function BoardsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { claims } = await requireClaims()
  const { userName, userAvatar } = getClaimsDisplayInfo(claims)

  return (
    <BoardsLayoutClient userName={userName} userAvatar={userAvatar}>
      {children}
    </BoardsLayoutClient>
  )
}
