import { withSentryConfig } from '@sentry/nextjs'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import type { NextConfig } from 'next'

// Prevent test-mode environment variables from reaching Vercel deployments.
// If either is set, ALL authentication is bypassed (proxy.ts, supabase/server.ts).
// NOTE: Only guard Vercel builds (VERCEL env is set). E2E CI builds intentionally
// use APP_ENV=test + next build, which sets NODE_ENV=production.
if (process.env.VERCEL && process.env.APP_ENV === 'test') {
  throw new Error(
    'FATAL: APP_ENV=test must not be set in Vercel builds. This would bypass all authentication.',
  )
}
if (process.env.VERCEL && process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK === 'true') {
  throw new Error(
    'FATAL: NEXT_PUBLIC_ENABLE_MSW_MOCK=true must not be set in Vercel builds. This would enable mock data.',
  )
}

const nextConfig: NextConfig = {
  turbopack: {
    rules: codeInspectorPlugin({
      bundler: 'turbopack',
      hotKeys: ['altKey'],
    }),
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // Report-Only mode: logs violations without blocking resources.
            // Once stable, switch to Content-Security-Policy (enforcement).
            // Sentry receives violation reports via report-uri directive.
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              // unsafe-inline needed for Next.js inline styles & Tailwind
              // unsafe-eval removed — only dev tooling (code-inspector-plugin) needs it
              "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https://avatars.githubusercontent.com https://github.com data: blob:",
              "connect-src 'self' https://*.supabase.co http://127.0.0.1:* https://api.github.com https://*.ingest.us.sentry.io https://vitals.vercel-insights.com",
              "font-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              // upgrade-insecure-requests: no-op in report-only mode;
              // will take effect when policy is switched to enforcement.
              'upgrade-insecure-requests',
              // Sentry CSP reporting endpoint
              'report-uri https://o1245861.ingest.us.sentry.io/api/4510597804261376/security/?sentry_key=06b1775946774ab1527986b339ea85ed',
            ].join('; '),
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()',
          },
        ],
      },
    ]
  },

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
    ],
  },

  // Experimental features
  experimental: {
    // Optimize package imports for tree-shaking and faster builds
    optimizePackageImports: [
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      'framer-motion', // Added to fix HMR issues
      'lucide-react',
    ],
  },
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'laststance',

  project: 'gitbox',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
})
