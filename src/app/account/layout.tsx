/**
 * Account Layout
 *
 * Layout for /account route
 * - Sidebar navigation
 * - Reads JWT claims (~5ms WebCrypto verify via `requireClaims`) for header
 *   user info. The /account page itself still uses `requireUser()` because
 *   it needs `user.created_at`, which is not in the JWT claims payload.
 */

import { requireClaims } from '@/lib/auth/require-claims'
import { getClaimsDisplayInfo } from '@/lib/utils/get-claims-display-info'

import { AccountLayoutClient } from './AccountLayoutClient'

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { claims } = await requireClaims()
  const { userName, userAvatar } = getClaimsDisplayInfo(claims)

  return (
    <AccountLayoutClient userName={userName} userAvatar={userAvatar}>
      {children}
    </AccountLayoutClient>
  )
}
