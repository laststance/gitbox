'use client'

/**
 * YouTube Demo Page
 *
 * Design: Bold, video-centric with signature red accents
 * Purpose: Test localStorage persistence when navigating from Gmail
 */

import ServicePageLayout from '@/components/services/ServicePageLayout'

const YouTubeIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      fill="#FF0000"
      d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 3.993L9 16z"
    />
  </svg>
)

/** Mock video thumbnails */
const mockVideos = [
  {
    title: 'Understanding localStorage Persistence',
    views: '1.2M views',
    duration: '12:34',
  },
  {
    title: 'Redux State Management Deep Dive',
    views: '856K views',
    duration: '28:15',
  },
  {
    title: 'Building Gmail Clone with Next.js',
    views: '2.1M views',
    duration: '45:00',
  },
  {
    title: 'SSR-Safe Hydration Patterns',
    views: '432K views',
    duration: '18:22',
  },
  {
    title: 'Performance Optimization Secrets',
    views: '1.8M views',
    duration: '23:45',
  },
  {
    title: 'Modern React Patterns 2025',
    views: '967K views',
    duration: '31:10',
  },
]

export default function YouTubePage() {
  return (
    <ServicePageLayout
      serviceName="YouTube"
      serviceIcon={YouTubeIcon}
      serviceColor="#FF0000"
    >
      <div className="p-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">
            <span className="text-red-500">You</span>Tube
          </h1>
          <p className="text-gray-400">Broadcast Yourself</p>
        </div>

        {/* Video Grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockVideos.map((video, index) => (
            <div
              key={index}
              className="group cursor-pointer"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden mb-3">
                {/* Placeholder gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${index * 60}, 50%, 20%) 0%, hsl(${index * 60 + 30}, 40%, 15%) 100%)`,
                  }}
                />

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-8 h-8 text-white ml-1"
                    >
                      <path fill="currentColor" d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 rounded text-xs text-white font-medium">
                  {video.duration}
                </div>
              </div>

              {/* Video Info */}
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-700 shrink-0" />
                <div>
                  <h3 className="text-white text-sm font-medium line-clamp-2 group-hover:text-blue-400 transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-gray-500 text-xs mt-1">
                    Tech Channel • {video.views} • 2 days ago
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Demo Note */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Demo page - Your Gmail emails persist across navigation!
          </p>
        </div>
      </div>
    </ServicePageLayout>
  )
}
