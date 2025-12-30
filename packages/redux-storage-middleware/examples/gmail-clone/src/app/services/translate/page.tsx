'use client'

/**
 * Google Translate Demo Page
 *
 * Design: Clean, editorial style with language pair focus
 * Purpose: Test localStorage persistence when navigating from Gmail
 */

import ServicePageLayout from '@/components/services/ServicePageLayout'

const TranslateIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      fill="#4285F4"
      d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04z"
    />
    <path
      fill="#4285F4"
      d="M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"
    />
  </svg>
)

export default function TranslatePage() {
  return (
    <ServicePageLayout
      serviceName="Translate"
      serviceIcon={TranslateIcon}
      serviceColor="#4285F4"
    >
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-light text-white mb-4 tracking-tight">
            Google Translate
          </h1>
          <p className="text-xl text-gray-400 max-w-md">
            Break down language barriers
          </p>
        </div>

        {/* Translation Box */}
        <div className="w-full max-w-4xl bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-800">
            {/* Source Language */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium text-blue-400">
                  English
                </span>
                <span className="text-gray-600">•</span>
                <span className="text-xs text-gray-500">Detected</span>
              </div>
              <textarea
                className="w-full h-40 bg-transparent text-white text-lg resize-none focus:outline-none placeholder-gray-600"
                placeholder="Enter text to translate..."
                defaultValue="Your Gmail emails are safely persisted in localStorage!"
              />
            </div>

            {/* Target Language */}
            <div className="p-6 bg-gray-800/30">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium text-green-400">
                  Japanese
                </span>
              </div>
              <p className="text-white text-lg">
                あなたのGmailメールはlocalStorageに安全に保存されています！
              </p>
            </div>
          </div>
        </div>

        {/* Demo Note */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            This is a demo page. Navigate back to Gmail to see your emails are
            still there!
          </p>
        </div>
      </div>
    </ServicePageLayout>
  )
}
