/**
 * Open Graph Image
 *
 * Dynamic generation of Open Graph image for social media sharing.
 * Displayed when the app URL is shared on Twitter, Facebook, Slack, etc.
 *
 * Size: 1200x630 (standard OG image dimensions)
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'GitBox - Manage GitHub repositories in Kanban board format'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, #1f2328 0%, #2d333b 50%, #1f2328 100%)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Logo and Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          marginBottom: 32,
        }}
      >
        {/* GitHub-style icon */}
        <div
          style={{
            width: 100,
            height: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff',
            borderRadius: 20,
          }}
        >
          <svg width="70" height="70" viewBox="0 0 24 24" fill="#1f2328">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
        </div>
        <span
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          GitBox
        </span>
      </div>

      {/* Tagline */}
      <p
        style={{
          fontSize: 32,
          color: '#8b949e',
          margin: 0,
          textAlign: 'center',
          maxWidth: 800,
        }}
      >
        Manage GitHub repositories in Kanban board format
      </p>

      {/* Kanban preview hint */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 48,
        }}
      >
        {['Pending', 'In Progress', 'Review', 'Done'].map((label) => (
          <div
            key={label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 24px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span style={{ fontSize: 18, color: '#8b949e' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>,
    {
      ...size,
    },
  )
}
