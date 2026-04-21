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

expect.extend(matchers)

// Mocked because happy-dom's localStorage implementation doesn't reset between tests
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

afterEach(() => {
  cleanup()
  localStorageMock.clear()
})

// Mocked because next/navigation hooks require a Next.js runtime not present in Vitest
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

// Mocked because next/headers requires a Next.js request context unavailable in Vitest
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
