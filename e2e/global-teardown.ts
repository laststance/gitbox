/**
 * Playwright Global Teardown
 *
 * Runs once after all tests complete to clean up.
 * Resets local Supabase database to initial state.
 *
 * @see https://playwright.dev/docs/test-global-setup-teardown
 */
import { execSync } from 'node:child_process'

/**
 * Global teardown function executed after all tests.
 * Skips database reset since tests have completed successfully.
 * The next test run's globalSetup will reset the database.
 */
export default async function globalTeardown(): Promise<void> {
  // Skip database reset during teardown
  // - Tests have already completed, so cleanup is not strictly necessary
  // - The next test run's globalSetup will reset the database
  // - Avoids potential container restart errors at the end of test runs
  console.log('✅ Tests completed. Database will be reset on next test run.')
}
