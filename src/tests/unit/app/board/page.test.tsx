/**
 * Unit Tests: /board/[id] page without a session
 *
 * The proxy checks the session before this page runs, but the session can end
 * in between, or the check inside the page can fail on its own. The page then
 * has no owner to look the board up for. It used to answer "Board not found",
 * which told the owner of the board that their board was gone. It has to send
 * them to the login page instead.
 *
 * @see src/app/board/[id]/page.tsx
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

import BoardPage from '@/app/board/[id]/page'
import { getBoardBundle } from '@/lib/actions/board-data'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'

// next/navigation's redirect() and notFound() throw in real Next.js. Mirror
// that so the test can tell which of the two ended the render.
const mockRedirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
})
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
  notFound: () => mockNotFound(),
}))

vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(),
}))

vi.mock('@/lib/actions/board-data', () => ({
  getBoardBundle: vi.fn(async () => null),
}))

// The client tree is not rendered here; only the page's own decisions are.
vi.mock('@/app/board/[id]/BoardPageClient', () => ({
  BoardPageClient: (): null => null,
}))

describe('BoardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('sends a visitor without a session to the login page instead of "Board not found"', async () => {
    // Arrange
    vi.mocked(getCachedClaims).mockResolvedValue(null)
    const pageProps = {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000100' }),
    }

    // Act
    const render = BoardPage(pageProps)

    // Assert
    await expect(render).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(mockNotFound).not.toHaveBeenCalled()
    expect(getBoardBundle).not.toHaveBeenCalled()
  })

  test('shows "Board not found" to a signed-in visitor when the board is not theirs', async () => {
    // Arrange: a session exists and getBoardBundle finds no board for it
    vi.mocked(getCachedClaims).mockResolvedValue({
      supabase: {} as never,
      claims: {
        iss: 'supabase-demo',
        sub: '00000000-0000-0000-0000-000000000001',
        aud: 'authenticated',
        exp: 4102444800,
        iat: 1767225600,
        role: 'authenticated',
      },
    })
    const pageProps = {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000110' }),
    }

    // Act
    const render = BoardPage(pageProps)

    // Assert
    await expect(render).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
