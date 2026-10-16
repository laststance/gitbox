/**
 * Unit Tests: local E2E builds do not read production from `.env.production`.
 *
 * `pnpm build` reads `.env.production` ahead of `.env`. A shell variable wins
 * over both files. Without one, a machine that has that file uploads the
 * source maps of a test build and gives `pnpm e2e` production's service-role
 * key, which the local stack refuses.
 *
 * @see scripts/e2e-parallel.sh
 * @see playwright.config.ts
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

const REPO_ROOT = process.cwd()

/** The local demo service-role key, the one account deletion must use. */
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

/**
 * The environment assignments of one command in a shell script.
 * The window is the current command block, so a later command cannot pass
 * on assignments that belong to an earlier one.
 * @param script - The whole script.
 * @param command - The command those assignments prefix.
 * @returns The lines of that command's block, above the command.
 */
function commandEnv(script: string, command: string): string {
  const at = script.indexOf(command)
  const blockStart = script.lastIndexOf('\n\n', at)
  return script.slice(blockStart < 0 ? 0 : blockStart + 2, at)
}

describe('local E2E builds', () => {
  test('a parallel E2E build and its servers do not take the production site URL or the Sentry token', () => {
    // Arrange
    const script = readFileSync(
      join(REPO_ROOT, 'scripts/e2e-parallel.sh'),
      'utf8',
    )

    // Act
    const buildEnv = commandEnv(script, 'pnpm build')
    const startEnv = commandEnv(script, 'pnpm exec next start')

    // Assert
    expect(script).toContain('LOCAL_SITE_URL="http://localhost:3008"')
    expect(buildEnv).toContain('NEXT_PUBLIC_SITE_URL="${LOCAL_SITE_URL}"')
    expect(buildEnv).toContain('SENTRY_AUTH_TOKEN=""')
    // The build's own URL. The server block must not satisfy this.
    expect(buildEnv).toContain(
      'NEXT_PUBLIC_SUPABASE_URL="${LOCAL_SUPABASE_URL}"',
    )
    expect(startEnv).toContain('NEXT_PUBLIC_SITE_URL="${LOCAL_SITE_URL}"')
    expect(startEnv).toContain('SENTRY_AUTH_TOKEN=""')
    expect(startEnv).not.toContain(
      'NEXT_PUBLIC_SUPABASE_URL="${LOCAL_SUPABASE_URL}"',
    )
  })

  test('pnpm e2e gives its build and its server the local service-role key, the local site URL and an empty Sentry token', () => {
    // Arrange
    const config = readFileSync(join(REPO_ROOT, 'playwright.config.ts'), 'utf8')
    const webServer = config.slice(config.indexOf('webServer:'))

    // Act
    const env = webServer.slice(0, webServer.indexOf('},'))

    // Assert
    expect(config).toContain(LOCAL_SERVICE_ROLE_KEY)
    expect(config).toContain("const LOCAL_SITE_URL = 'http://localhost:3008'")
    expect(env).toMatch(
      /(?:^|\r?\n)[ \t]*SUPABASE_URL[ \t]*:[ \t]*LOCAL_SUPABASE_URL[ \t]*(?:,|\r?\n|$)/,
    )
    expect(env).toContain(
      'SUPABASE_SERVICE_ROLE_KEY: LOCAL_SUPABASE_SERVICE_ROLE_KEY',
    )
    expect(env).toContain('NEXT_PUBLIC_SITE_URL: LOCAL_SITE_URL')
    expect(env).toContain("SENTRY_AUTH_TOKEN: ''")
  })
})
