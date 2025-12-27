/**
 * MSW Mock Data Reset API Route
 *
 * This route allows E2E tests to reset the MSW mock data state between tests.
 * Only available in test mode (when MSW is enabled).
 *
 * @example
 * // In Playwright test beforeEach:
 * await page.request.post('http://localhost:3008/__msw__/reset')
 */

import { NextResponse } from 'next/server'

import { isMSWEnabled } from '@/lib/utils/isMSWEnabled'
import { resetMockData } from '@/mocks/handlers'

export async function POST() {
  // Only allow when MSW is enabled (test mode)
  if (!isMSWEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Reset endpoint only available in test mode' },
      { status: 403 },
    )
  }

  resetMockData()

  return NextResponse.json({
    success: true,
    message: 'Mock data reset to initial state',
  })
}
