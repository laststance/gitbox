/**
 * Vitest Test Setup
 *
 * Global test configuration for happy-dom environment.
 * Happy-dom provides native support for: localStorage, matchMedia,
 * IntersectionObserver, ResizeObserver - no mocks needed for these APIs.
 *
 * Environment variables are loaded from .env.test via vitest.config.ts
 * using Vite's loadEnv() function.
 */

import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { expect, afterEach, vi } from 'vitest'

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => ({
    get: vi.fn(),
  }),
}))
