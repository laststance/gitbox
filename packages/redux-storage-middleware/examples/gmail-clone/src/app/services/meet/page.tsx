'use client'

/**
 * Google Meet Demo Page
 *
 * Design: Video call interface with participant grid
 * Purpose: Test localStorage persistence when navigating from Gmail
 */

import ServicePageLayout from '@/components/services/ServicePageLayout'

const MeetIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      fill="#00897B"
      d="M12 11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
    />
    <path
      fill="#00897B"
      d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z"
    />
  </svg>
)

const participants = [
  { name: 'You', initials: 'YO', color: '#4285F4', speaking: true },
  { name: 'Alice', initials: 'AL', color: '#EA4335', speaking: false },
  { name: 'Bob', initials: 'BO', color: '#FBBC05', speaking: false },
  { name: 'Charlie', initials: 'CH', color: '#34A853', speaking: true },
]

export default function MeetPage() {
  return (
    <ServicePageLayout
      serviceName="Meet"
      serviceIcon={MeetIcon}
      serviceColor="#00897B"
    >
      <div className="h-[calc(100vh-200px)] bg-gray-950 flex flex-col">
        {/* Video Grid */}
        <div className="flex-1 p-4 grid grid-cols-2 gap-4">
          {participants.map((participant, index) => (
            <div
              key={index}
              className={`relative rounded-2xl overflow-hidden ${
                participant.speaking ? 'ring-2 ring-teal-500' : ''
              }`}
              style={{
                background: `linear-gradient(135deg, ${participant.color}30 0%, ${participant.color}10 100%)`,
              }}
            >
              {/* Avatar */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-medium text-white"
                  style={{ backgroundColor: participant.color }}
                >
                  {participant.initials}
                </div>
              </div>

              {/* Name Tag */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                  {participant.name}
                </span>
                {participant.speaking && (
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute h-2 w-2 rounded-full bg-teal-400 opacity-75" />
                    <span className="relative rounded-full h-2 w-2 bg-teal-500" />
                  </span>
                )}
              </div>

              {/* Mute indicator */}
              {!participant.speaking && (
                <div className="absolute bottom-4 right-4 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="p-4 flex items-center justify-center gap-4 bg-gray-900/50">
          <button className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
          <button className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
          </button>
          <button className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-white hover:bg-red-700 transition-colors">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
          <button className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </button>
        </div>
      </div>
    </ServicePageLayout>
  )
}
