/**
 * Unit Tests: the Supabase CLI version of the workflows
 *
 * `supabase-production.yml` runs the migrations on production as soon as a
 * commit reaches `main`, and `e2e.yml` applies the same migrations before the
 * E2E suite. Each installs the Supabase CLI at a pinned version. A migration
 * is tested with the CLI that later runs it on production only while the two
 * pins are the same, so they are raised together. This file reads both
 * workflows and fails when one pin moves without the other.
 *
 * @see .github/workflows/supabase-production.yml
 * @see .github/workflows/e2e.yml
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

describe('the Supabase CLI the workflows install', () => {
  test('is the same version for the production migration and for the E2E suite', () => {
    // Arrange
    const workflowPaths = [
      '.github/workflows/supabase-production.yml',
      '.github/workflows/e2e.yml',
    ]

    // Act
    const pinnedVersions = workflowPaths.map(readSupabaseCliVersion)

    // Assert: raise this value together with both pins and the local CLI
    expect(pinnedVersions).toEqual(['2.120.0', '2.120.0'])
  })
})

/**
 * Reads the version a workflow hands to its `supabase/setup-cli` step.
 *
 * @param workflowPath - Workflow file, relative to the repository root.
 * @returns The pinned version, or `'not pinned'` when the step is missing or
 * has no `version:` of its own (the action would then install the latest).
 * @example
 * readSupabaseCliVersion('.github/workflows/e2e.yml') // => '2.120.0'
 */
function readSupabaseCliVersion(workflowPath: string): string {
  const workflow = readFileSync(join(process.cwd(), workflowPath), 'utf8')

  // From the setup step up to the next step of the job
  const setupStepStart = workflow.indexOf('uses: supabase/setup-cli@')
  if (setupStepStart === -1) return 'not pinned'
  const nextStepStart = workflow.indexOf('\n      - ', setupStepStart)
  const setupStep = workflow.slice(
    setupStepStart,
    nextStepStart === -1 ? undefined : nextStepStart,
  )

  return /^\s+version:\s*(\S+)\s*$/m.exec(setupStep)?.[1] ?? 'not pinned'
}
