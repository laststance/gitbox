/** @type {import('next').NextConfig} */
const withNextIntl = require('next-intl/plugin')();

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // next-intl configuration
  i18n: {
    locales: ['en', 'ja'],
    defaultLocale: 'ja',
  },

  // PWA configuration (will be enhanced with next-pwa in US8)
  // PWA support will be added in Phase 10 (User Story 8)

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ]
  },

  // Image optimization
  images: {
    domains: ['avatars.githubusercontent.com', 'github.com'],
  },

  // Experimental features
  experimental: {
    optimizePackageImports: ['@dnd-kit/core', '@dnd-kit/sortable'],
  },
}

module.exports = withNextIntl(nextConfig)
