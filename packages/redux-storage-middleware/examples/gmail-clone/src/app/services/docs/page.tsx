'use client'

/**
 * Google Docs Demo Page
 *
 * Design: Clean document editor with toolbar
 * Purpose: Test localStorage persistence when navigating from Gmail
 */

import ServicePageLayout from '@/components/services/ServicePageLayout'

const DocsIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      fill="#4285F4"
      d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
    />
  </svg>
)

export default function DocsPage() {
  return (
    <ServicePageLayout
      serviceName="Docs"
      serviceIcon={DocsIcon}
      serviceColor="#4285F4"
    >
      <div className="flex flex-col h-[calc(100vh-200px)]">
        {/* Toolbar */}
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-2 flex-wrap">
          {[
            'Undo',
            'Redo',
            '|',
            'Bold',
            'Italic',
            'Underline',
            '|',
            'Align',
            'List',
            '|',
            'Insert',
          ].map((item, i) =>
            item === '|' ? (
              <div key={i} className="w-px h-6 bg-gray-700" />
            ) : (
              <button
                key={i}
                className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              >
                {item}
              </button>
            ),
          )}
        </div>

        {/* Document Area */}
        <div className="flex-1 bg-gray-950 overflow-auto p-8">
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-2xl p-12 min-h-[800px]">
            {/* Document Title */}
            <h1
              className="text-3xl font-normal text-gray-900 mb-8 outline-none border-b border-transparent hover:border-gray-200 pb-2"
              contentEditable
              suppressContentEditableWarning
            >
              localStorage Persistence Demo
            </h1>

            {/* Document Content */}
            <div
              className="prose prose-gray max-w-none"
              contentEditable
              suppressContentEditableWarning
            >
              <p className="text-gray-700 leading-relaxed mb-4">
                This is a demonstration of the{' '}
                <strong>redux-storage-middleware</strong> package. When you
                navigate between different Google services in this demo, your
                Gmail emails remain safely persisted in localStorage.
              </p>

              <h2 className="text-xl font-medium text-gray-900 mt-8 mb-4">
                Key Features
              </h2>

              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
                <li>SSR-safe hydration for Next.js</li>
                <li>Debounced writes for performance</li>
                <li>Selective slice persistence</li>
                <li>Schema versioning support</li>
              </ul>

              <h2 className="text-xl font-medium text-gray-900 mt-8 mb-4">
                How to Test
              </h2>

              <ol className="list-decimal list-inside text-gray-700 space-y-2">
                <li>Go back to Gmail and add some emails</li>
                <li>Navigate to any other service (YouTube, Maps, etc.)</li>
                <li>Return to Gmail - your emails should still be there!</li>
              </ol>

              <p className="text-gray-500 text-sm mt-8 italic">
                Start typing to edit this document...
              </p>
            </div>
          </div>
        </div>
      </div>
    </ServicePageLayout>
  )
}
