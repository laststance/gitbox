'use client'

/**
 * Google Maps Demo Page
 *
 * Design: Dark map-style with location markers
 * Purpose: Test localStorage persistence when navigating from Gmail
 */

import ServicePageLayout from '@/components/services/ServicePageLayout'

const MapsIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      fill="#EA4335"
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
    />
    <circle fill="#fff" cx="12" cy="9" r="2.5" />
  </svg>
)

export default function MapsPage() {
  return (
    <ServicePageLayout
      serviceName="Maps"
      serviceIcon={MapsIcon}
      serviceColor="#34A853"
    >
      <div className="relative h-[calc(100vh-200px)] bg-gray-900 overflow-hidden">
        {/* Fake Map Background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(90deg, transparent 49.9%, #333 50%, transparent 50.1%),
              linear-gradient(transparent 49.9%, #333 50%, transparent 50.1%),
              linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)
            `,
            backgroundSize: '80px 80px, 80px 80px, 100% 100%',
          }}
        />

        {/* Map Overlay Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950/50" />

        {/* Location Markers */}
        <div className="absolute top-1/4 left-1/3">
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-2 bg-red-500/20 rounded-full animate-ping" />
            <div className="relative w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white">
                <path
                  fill="currentColor"
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                />
              </svg>
            </div>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
              Your Location
            </div>
          </div>
        </div>

        <div className="absolute top-1/2 right-1/4">
          <div className="relative group cursor-pointer">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white text-xs font-bold">A</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-1/3 left-1/2">
          <div className="relative group cursor-pointer">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white text-xs font-bold">B</span>
            </div>
          </div>
        </div>

        {/* Search Card */}
        <div className="absolute top-6 left-6 right-6 md:right-auto md:w-96">
          <div className="bg-gray-800/95 backdrop-blur rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
                <input
                  type="text"
                  className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none"
                  placeholder="Search Google Maps"
                  defaultValue="localStorage persistence demo"
                />
              </div>
            </div>
            <div className="border-t border-gray-700 p-3 bg-gray-900/50">
              <p className="text-xs text-gray-500">
                Navigate between services to test persistence
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="absolute right-6 bottom-1/2 translate-y-1/2 flex flex-col gap-2">
          <button className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-white hover:bg-gray-700 transition-colors shadow-lg">
            +
          </button>
          <button className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-white hover:bg-gray-700 transition-colors shadow-lg">
            −
          </button>
        </div>
      </div>
    </ServicePageLayout>
  )
}
