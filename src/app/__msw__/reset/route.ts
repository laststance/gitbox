/**
 * MSW Mock Data Reset API Route
 *
 * Legacy endpoint kept for backward compatibility.
 * With real DB E2E testing, mock data reset is no longer needed —
 * each shard has its own isolated database.
 *
 * @example
 * await page.request.post('htp://localhost:3008/__msw__/reset')
 */

import { NextResponse } from 'next/server'

import { isMSWEnabled } from '@/lib/utils/isMSWEnabled'

export async function POST() {
  if (!isMSWEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Reset endpoint only available in test mode' },
      { status: 403 },
    )
  }

  // No-op: With real DB per shard, mock data reset is unnecessary.
  // Each E2E shard has its own isolated PostgreSQL database.
  return NextResponse.json({
    success: true,
    message: 'No-op: using real database per shard',
  })
}
