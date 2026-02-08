/**
 * Playwright Global Setup
 *
 * Runs once before all tests to prepare the database.
 * Resets local Supabase database and applies seed data.
 *
 * @see https://playwright.dev/docs/test-global-setup-teardown
 */
import { execSync } from 'node:child_process'

/**
 * Global setup function executed before all tests.
 * Resets the local Supabase database to ensure clean test state.
 *
 * In CI, the database is already reset by the workflow's "Start Supabase" step
 * (`supabase db reset --local`), so we skip the redundant reset here.
 * The `pnpm db:reset` script uses `source .env` which requires a local
 * `.env` file that doesn't exist in CI.
 */
export default async function globalSetup(): Promise<void> {
  // CI already resets the database in the workflow step before running tests
  if (process.env.CI) {
    console.log('⏭️ Skipping db:reset in CI (already done by workflow)')
    return
  }

  console.log('🔄 Resetting local Supabase database...')

  try {
    // Reset database - this applies migrations and seed.sql
    // Note: The command may return non-zero exit code due to container restart
    // errors, but the database reset itself usually succeeds. We check stderr
    // for the critical "Seeding data" message to confirm success.
    const result = execSync('pnpm db:reset 2>&1', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Suppress debug output for cleaner logs
        DEBUG: '',
      },
      encoding: 'utf8',
    })

    // Check if seeding completed
    if (result.includes('Seeding data from')) {
      console.log('✅ Database reset complete')
    } else {
      throw new Error(`Database reset may have failed. Output: ${result}`)
    }
  } catch (error: unknown) {
    // If the error contains successful seeding, consider it a success
    // The "Restarting containers" step sometimes fails but data is seeded
    const errorOutput =
      error instanceof Error && 'stdout' in error
        ? String((error as NodeJS.ErrnoException & { stdout: string }).stdout)
        : ''
    const stderrOutput =
      error instanceof Error && 'stderr' in error
        ? String((error as NodeJS.ErrnoException & { stderr: string }).stderr)
        : ''
    const combinedOutput = errorOutput + stderrOutput

    if (combinedOutput.includes('Seeding data from')) {
      console.log(
        '✅ Database reset complete (container restart warning ignored)',
      )
    } else {
      console.error('❌ Failed to reset database:', error)
      throw error
    }
  }
}
