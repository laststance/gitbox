'use client'

/**
 * Google Search Demo Page
 *
 * Design: Minimalist, centered search with Google colors
 * Purpose: Test localStorage persistence when navigating from Gmail
 */

import ServicePageLayout from '@/components/services/ServicePageLayout'

const SearchIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      fill="#4285F4"
      d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
    />
  </svg>
)

export default function SearchPage() {
  return (
    <ServicePageLayout
      serviceName="Search"
      serviceIcon={SearchIcon}
      serviceColor="#4285F4"
    >
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-8">
        {/* Google Logo */}
        <div className="mb-8">
          <h1 className="text-7xl font-normal">
            <span className="text-blue-500">G</span>
            <span className="text-red-500">o</span>
            <span className="text-yellow-500">o</span>
            <span className="text-blue-500">g</span>
            <span className="text-green-500">l</span>
            <span className="text-red-500">e</span>
          </h1>
        </div>

        {/* Search Box */}
        <div className="w-full max-w-xl">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
            </div>
            <input
              type="text"
              className="w-full py-4 pl-12 pr-4 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Search the web..."
              defaultValue="redux-storage-middleware localStorage"
            />
          </div>

          {/* Search Buttons */}
          <div className="flex justify-center gap-4 mt-6">
            <button className="px-6 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm">
              Google Search
            </button>
            <button className="px-6 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm">
              I'm Feeling Lucky
            </button>
          </div>
        </div>

        {/* Demo Note */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Demo page - Your Gmail state persists across navigation!
          </p>
        </div>
      </div>
    </ServicePageLayout>
  )
}
