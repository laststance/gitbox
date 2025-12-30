'use client'

/**
 * Google Photos Demo Page
 *
 * Design: Masonry-style photo grid with colorful thumbnails
 * Purpose: Test localStorage persistence when navigating from Gmail
 */

import ServicePageLayout from '@/components/services/ServicePageLayout'

const PhotosIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path fill="#EA4335" d="M12 2L4 12h8z" />
    <path fill="#FBBC05" d="M12 2l8 10h-8z" />
    <path fill="#4285F4" d="M4 12l8 10V12z" />
    <path fill="#34A853" d="M20 12l-8 10V12z" />
  </svg>
)

/** Generate mock photo colors */
const mockPhotos = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  hue: (i * 37) % 360,
  height: [150, 200, 180, 220, 160, 240][i % 6],
}))

export default function PhotosPage() {
  return (
    <ServicePageLayout
      serviceName="Photos"
      serviceIcon={PhotosIcon}
      serviceColor="#FBBC05"
    >
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-white mb-2">Photos</h1>
          <p className="text-gray-500">Your memories, organized</p>
        </div>

        {/* Photo Grid */}
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4">
          {mockPhotos.map((photo, index) => (
            <div
              key={photo.id}
              className="mb-4 break-inside-avoid group cursor-pointer"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div
                className="rounded-xl overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-2xl group-hover:scale-[1.02]"
                style={{
                  height: photo.height,
                  background: `linear-gradient(135deg, hsl(${photo.hue}, 60%, 40%) 0%, hsl(${photo.hue + 40}, 50%, 30%) 100%)`,
                }}
              >
                {/* Overlay on hover */}
                <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <svg
                    className="w-8 h-8 text-white/80"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Demo Note */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            Demo page - Your Gmail emails persist across navigation!
          </p>
        </div>
      </div>
    </ServicePageLayout>
  )
}
