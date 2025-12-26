/**
 * Next.js 16 Proxy Configuration
 *
 * This file exists to prevent Turbopack from scanning parent directories
 * and finding the main GitBox proxy.ts which uses project-specific imports.
 *
 * Gmail-clone example app doesn't need authentication proxying.
 */

import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proxy function that allows all requests through without authentication.
 * @param request - The incoming request
 * @returns Next response allowing the request to proceed
 */
export async function proxy(request: NextRequest) {
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
}

export const config = {
  matcher: [],
}
