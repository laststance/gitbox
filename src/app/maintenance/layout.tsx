/**
 * Maintenance Layout
 *
 * Layout for /maintenance route
 * - Theme application for authenticated users
 * - Auth gate via JWT claims (~5ms WebCrypto verify) instead of the ~50ms
 *   `auth.getUser()` round-trip. Claims body is unused here; the call exists
 *   for its redirect side effect when the JWT is missing or expired.
 */

import { ThemeApplicator } from '@/components/ThemeApplicator'
import { requireClaims } from '@/lib/auth/require-claims'

export default async function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireClaims()

  return (
    <>
      <ThemeApplicator />
      {children}
    </>
  )
}
