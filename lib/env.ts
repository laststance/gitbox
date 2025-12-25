/**
 * Environment Variables Schema (t3-env)
 *
 * Type-safe environment variable validation using @t3-oss/env-nextjs.
 * Provides runtime validation and TypeScript types for all env vars.
 *
 * @description
 * - NEXT_PUBLIC_* vars are exposed to the browser (client section)
 * - Server vars are only available on the server (server section)
 * - APP_ENV distinguishes test from development (NODE_ENV is auto-set to 'production' after build)
 * - NEXT_PUBLIC_ENABLE_MSW_MOCK controls MSW activation
 */
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  /**
   * Server-side environment variables schema.
   * These are only available on the server.
   */
  server: {
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    // APP_ENV is separate from NODE_ENV because Next.js sets NODE_ENV to 'production'
    // after running `next build`, regardless of the actual deployment target.
    // This allows MSW mocking in production builds for E2E testing.
    APP_ENV: z
      .enum(['development', 'test', 'production'])
      .optional()
      .default('development'),
  },

  /**
   * Client-side environment variables schema.
   * These are exposed to the browser via NEXT_PUBLIC_ prefix.
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    // MSW activation flag - only check this on client side
    // Server also requires APP_ENV=test for activation
    NEXT_PUBLIC_ENABLE_MSW_MOCK: z
      .string()
      .optional()
      .default('false')
      .transform((val) => val === 'true'),
  },

  /**
   * Runtime environment variables.
   * For Next.js >= 13.4.4, you need to destructure manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ENABLE_MSW_MOCK: process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK,
  },

  /**
   * Skip validation in certain environments.
   * Set SKIP_ENV_VALIDATION=1 to skip validation (useful for Docker builds).
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Treat empty strings as undefined.
   * Useful for optional env vars that might be set to empty string.
   */
  emptyStringAsUndefined: true,
})
