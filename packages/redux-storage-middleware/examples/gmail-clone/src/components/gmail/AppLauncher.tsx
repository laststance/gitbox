'use client'

/**
 * Google-style App Launcher Grid Component
 *
 * Design Philosophy:
 * - Material You dark theme with vibrant service icons
 * - Smooth staggered reveal animation on open
 * - Hover effects with subtle scale and glow
 * - Backdrop blur for depth perception
 *
 * Architecture:
 * - 3x4 grid matching Google's actual app launcher
 * - Each service links to its own dedicated page
 * - Icons use actual Google service colors for authenticity
 */

import { memo } from 'react'
import Link from 'next/link'

/** Service definition for app launcher grid */
interface ServiceItem {
  id: string
  name: string
  href: string
  icon: React.ReactNode
  color: string
}

/** Google-style service icons as SVG components */
const services: ServiceItem[] = [
  {
    id: 'translate',
    name: 'Translate',
    href: '/services/translate',
    color: '#4285F4',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path
          fill="#4285F4"
          d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04z"
        />
        <path
          fill="#4285F4"
          d="M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"
        />
      </svg>
    ),
  },
  {
    id: 'search',
    name: 'Search',
    href: '/services/search',
    color: '#4285F4',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path
          fill="#4285F4"
          d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
        />
      </svg>
    ),
  },
  {
    id: 'youtube',
    name: 'YouTube',
    href: '/services/youtube',
    color: '#FF0000',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path
          fill="#FF0000"
          d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 3.993L9 16z"
        />
      </svg>
    ),
  },
  {
    id: 'maps',
    name: 'Maps',
    href: '/services/maps',
    color: '#34A853',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path
          fill="#EA4335"
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        />
        <circle fill="#fff" cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    id: 'docs',
    name: 'Docs',
    href: '/services/docs',
    color: '#4285F4',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path
          fill="#4285F4"
          d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
        />
      </svg>
    ),
  },
  {
    id: 'calendar',
    name: 'Calendar',
    href: '/services/calendar',
    color: '#4285F4',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path
          fill="#4285F4"
          d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"
        />
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fill="#4285F4"
          fontSize="8"
          fontWeight="bold"
        >
          {new Date().getDate()}
        </text>
      </svg>
    ),
  },
  {
    id: 'photos',
    name: 'Photos',
    href: '/services/photos',
    color: '#FBBC05',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path fill="#EA4335" d="M12 2L4 12h8z" />
        <path fill="#FBBC05" d="M12 2l8 10h-8z" />
        <path fill="#4285F4" d="M4 12l8 10V12z" />
        <path fill="#34A853" d="M20 12l-8 10V12z" />
      </svg>
    ),
  },
  {
    id: 'news',
    name: 'News',
    href: '/services/news',
    color: '#4285F4',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <rect fill="#4285F4" x="3" y="3" width="18" height="18" rx="2" />
        <rect fill="#fff" x="5" y="5" width="6" height="6" />
        <rect fill="#fff" x="13" y="5" width="6" height="2" />
        <rect fill="#fff" x="13" y="9" width="6" height="2" />
        <rect fill="#fff" x="5" y="13" width="14" height="2" />
        <rect fill="#fff" x="5" y="17" width="10" height="2" />
      </svg>
    ),
  },
  {
    id: 'meet',
    name: 'Meet',
    href: '/services/meet',
    color: '#00897B',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path
          fill="#00897B"
          d="M12 11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
        />
        <path
          fill="#00897B"
          d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z"
        />
        <path
          fill="#00897B"
          d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"
        />
      </svg>
    ),
  },
  {
    id: 'chat',
    name: 'Chat',
    href: '/services/chat',
    color: '#34A853',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path
          fill="#34A853"
          d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
        />
      </svg>
    ),
  },
  {
    id: 'drive',
    name: 'Drive',
    href: '/services/drive',
    color: '#FBBC05',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path fill="#FBBC05" d="M8 16l-4-7 4-7h8l4 7-4 7z" />
        <path fill="#4285F4" d="M4 9l4 7h12l-4-7z" />
        <path fill="#34A853" d="M16 2l4 7H8l4-7z" />
      </svg>
    ),
  },
  {
    id: 'sheets',
    name: 'Sheets',
    href: '/services/sheets',
    color: '#34A853',
    icon: (
      <svg viewBox="0 0 24 24" className="w-10 h-10">
        <path
          fill="#34A853"
          d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
        />
        <path fill="#fff" d="M5 5h6v6H5z" />
        <path fill="#fff" d="M13 5h6v6h-6z" />
        <path fill="#fff" d="M5 13h6v6H5z" />
        <path fill="#fff" d="M13 13h6v6h-6z" />
        <path
          fill="#34A853"
          d="M6 6h4v4H6zM14 6h4v4h-4zM6 14h4v4H6zM14 14h4v4h-4z"
        />
      </svg>
    ),
  },
]

interface AppLauncherProps {
  onClose: () => void
}

/**
 * Google-style App Launcher popup grid
 *
 * Features:
 * - 3x4 responsive grid layout
 * - Staggered entrance animations
 * - Hover effects with subtle scale
 * - Dark theme with backdrop blur
 * - Click outside to close
 */
function AppLauncher({ onClose }: AppLauncherProps) {
  return (
    <div
      className="absolute right-0 top-12 z-50 w-80 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      style={{
        background: 'linear-gradient(180deg, #2d2d2d 0%, #1a1a1a 100%)',
        backdropFilter: 'blur(20px)',
      }}
      data-testid="app-launcher-popup"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-gray-700/50">
        <h3 className="text-sm font-medium text-gray-300 tracking-wide">
          Google Services Demo
        </h3>
      </div>

      {/* Service Grid */}
      <div className="p-4 grid grid-cols-3 gap-2">
        {services.map((service, index) => (
          <Link
            key={service.id}
            href={service.href}
            onClick={onClose}
            className="group flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 hover:bg-gray-700/50 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            style={{
              animationDelay: `${index * 30}ms`,
            }}
            data-testid={`app-launcher-${service.id}`}
          >
            {/* Icon with glow effect on hover */}
            <div
              className="relative mb-2 transition-transform duration-200 group-hover:scale-110"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            >
              <div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-30 transition-opacity blur-xl"
                style={{ backgroundColor: service.color }}
              />
              {service.icon}
            </div>

            {/* Label */}
            <span className="text-xs text-gray-300 font-medium truncate w-full text-center group-hover:text-white transition-colors">
              {service.name}
            </span>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-700/50 bg-gray-800/30">
        <p className="text-xs text-gray-500 text-center">
          Click a service to test localStorage persistence
        </p>
      </div>
    </div>
  )
}

export default memo(AppLauncher)
