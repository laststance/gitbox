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
 */
export default async function globalSetup(): Promise<void> {
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
