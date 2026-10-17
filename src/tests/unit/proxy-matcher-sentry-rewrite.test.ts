/**
 * Unit Tests: the proxy still stands in front of Sentry's own tunnel rewrite
 *
 * `tunnelRoute` registers a rewrite that forwards cookies and takes the
 * Sentry project from the query string. It stays unused only while the proxy
 * runs for every path that rewrite matches. These tests compile the matcher
 * the build compiles, and pin the rewrite source. They do not boot Next and
 * they do not send a report.
 *
 * @see src/proxy.ts
 * @see next.config.ts
 */

import { describe, expect, test } from 'vitest'

import { config } from '@/proxy'

import nextConfig from '../../../next.config'

type CompiledMatcher = { regexp: string }

type Rewrite = { source?: string; destination?: string }

type RewriteGroups = {
  beforeFiles?: Rewrite[]
  afterFiles?: Rewrite[]
  fallback?: Rewrite[]
}

// Next's build helper has no public types. It is the compiler that turns
// `config.matcher` into the regexp the proxy runs under.
const { getMiddlewareMatchers } =
  (await import('next/dist/build/analysis/get-page-static-info.js')) as unknown as {
    getMiddlewareMatchers: (
      matchers: readonly string[],
      nextConfig: { basePath?: string },
    ) => CompiledMatcher[]
  }

const tunnelPaths = ['/monitoring', '/Monitoring', '/monitoring/'] as const

const listRewrites = (result: unknown): Rewrite[] => {
  if (Array.isArray(result)) return result as Rewrite[]
  if (result && typeof result === 'object') {
    const groups = result as RewriteGroups
    return [
      ...(groups.beforeFiles ?? []),
      ...(groups.afterFiles ?? []),
      ...(groups.fallback ?? []),
    ]
  }
  return []
}

describe('proxy matcher', () => {
  // Value: protects=the proxy still runs for the paths the Sentry rewrite matches
  //   fails_when=the matcher excludes /monitoring, its trailing slash, or a capital M
  //   no_claim=the rewrite is unreachable in production. The test compiles the matcher; it does not boot Next.
  test('runs for /monitoring, /Monitoring, and /monitoring/', () => {
    // Arrange
    const matchers = config.matcher
    expect(typeof matchers[0]).toBe('string')
    const compiled = getMiddlewareMatchers(matchers, {})
    const regexp = new RegExp(compiled[0]?.regexp ?? '')

    // Act
    const matches = tunnelPaths.map((path) => regexp.test(path))

    // Assert
    expect(matches).toEqual([true, true, true])
  })
})

describe('Sentry tunnel rewrite', () => {
  // Value: protects=the registered rewrite source stays /monitoring(/?)
  //   fails_when=the source widens or a third ingest rewrite appears
  //   no_claim=a request with cookies reached Sentry. The test calls the config's rewrites function.
  test('pins both ingest rewrites at /monitoring(/?)', async () => {
    // Arrange
    const rewrites = nextConfig.rewrites
    if (typeof rewrites !== 'function') {
      throw new Error('The Next config does not expose rewrites.')
    }

    // Act
    const result = await rewrites()
    const ingestRewrites = listRewrites(result).filter((rewrite) =>
      rewrite.destination?.includes('sentry.io'),
    )

    // Assert
    expect(ingestRewrites.map((rewrite) => rewrite.source)).toEqual([
      '/monitoring(/?)',
      '/monitoring(/?)',
    ])
  })
})
