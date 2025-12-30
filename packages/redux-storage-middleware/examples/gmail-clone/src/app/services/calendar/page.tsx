'use client'

/**
 * Google Calendar Demo Page
 *
 * Design: Clean, grid-based with time-focused UI
 * Purpose: Test localStorage persistence when navigating from Gmail
 */

import ServicePageLayout from '@/components/services/ServicePageLayout'

const CalendarIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
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
)

/** Get current week days */
function getCurrentWeek() {
  const today = new Date()
  const days = []
  const dayOfWeek = today.getDay()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - dayOfWeek)

  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek)
    day.setDate(startOfWeek.getDate() + i)
    days.push(day)
  }
  return days
}

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hours = Array.from({ length: 12 }, (_, i) => i + 8) // 8 AM to 7 PM

/** Mock events */
const events = [
  {
    day: 1,
    startHour: 9,
    duration: 2,
    title: 'Team Standup',
    color: '#4285F4',
  },
  {
    day: 2,
    startHour: 14,
    duration: 1,
    title: 'Code Review',
    color: '#34A853',
  },
  {
    day: 3,
    startHour: 10,
    duration: 3,
    title: 'Sprint Planning',
    color: '#EA4335',
  },
  {
    day: 4,
    startHour: 15,
    duration: 2,
    title: 'Design Sync',
    color: '#FBBC05',
  },
  {
    day: 5,
    startHour: 11,
    duration: 1,
    title: '1:1 Meeting',
    color: '#4285F4',
  },
]

export default function CalendarPage() {
  const currentWeek = getCurrentWeek()
  const today = new Date()

  return (
    <ServicePageLayout
      serviceName="Calendar"
      serviceIcon={CalendarIcon}
      serviceColor="#4285F4"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium text-white">
              {today.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </h1>
            <p className="text-gray-500 text-sm">Week View</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              + Create Event
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-gray-800">
            <div className="p-3 border-r border-gray-800" />{' '}
            {/* Time column spacer */}
            {currentWeek.map((day, index) => {
              const isToday = day.toDateString() === today.toDateString()
              return (
                <div
                  key={index}
                  className={`p-3 text-center border-r border-gray-800 last:border-r-0 ${
                    isToday ? 'bg-blue-500/10' : ''
                  }`}
                >
                  <div className="text-xs text-gray-500 uppercase">
                    {weekDays[index]}
                  </div>
                  <div
                    className={`text-lg font-medium mt-1 ${
                      isToday
                        ? 'w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto'
                        : 'text-gray-300'
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Time Grid */}
          <div className="relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-8 border-b border-gray-800/50 last:border-b-0"
              >
                <div className="p-2 text-xs text-gray-500 text-right pr-3 border-r border-gray-800">
                  {hour > 12
                    ? `${hour - 12} PM`
                    : hour === 12
                      ? '12 PM'
                      : `${hour} AM`}
                </div>
                {Array.from({ length: 7 }).map((_, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="h-12 border-r border-gray-800/30 last:border-r-0"
                  />
                ))}
              </div>
            ))}

            {/* Events */}
            {events.map((event, index) => (
              <div
                key={index}
                className="absolute rounded-lg px-2 py-1 text-xs font-medium text-white overflow-hidden"
                style={{
                  backgroundColor: event.color,
                  left: `calc(${((event.day + 1) / 8) * 100}% + 2px)`,
                  width: `calc(${(1 / 8) * 100}% - 4px)`,
                  top: `${(event.startHour - 8) * 48 + 4}px`,
                  height: `${event.duration * 48 - 8}px`,
                }}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>

        {/* Demo Note */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Demo page - Navigate back to Gmail to verify email persistence!
          </p>
        </div>
      </div>
    </ServicePageLayout>
  )
}
