'use client'

import ServicePageLayout from '@/components/services/ServicePageLayout'

const SheetsIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      fill="#34A853"
      d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
    />
    <path fill="#fff" d="M5 5h6v6H5z" />
    <path fill="#fff" d="M13 5h6v6h-6z" />
    <path fill="#fff" d="M5 13h6v6H5z" />
    <path fill="#fff" d="M13 13h6v6h-6z" />
  </svg>
)

export default function SheetsPage() {
  return (
    <ServicePageLayout
      serviceName="Sheets"
      serviceIcon={SheetsIcon}
      serviceColor="#34A853"
    >
      <div className="p-6">
        <h1 className="text-2xl font-medium text-white mb-6">
          Untitled Spreadsheet
        </h1>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {/* Column Headers */}
          <div className="grid grid-cols-6 bg-gray-800">
            <div className="p-2 border-r border-gray-700 text-xs text-gray-500 text-center" />
            {['A', 'B', 'C', 'D', 'E'].map((col) => (
              <div
                key={col}
                className="p-2 border-r border-gray-700 last:border-r-0 text-xs text-gray-500 text-center font-medium"
              >
                {col}
              </div>
            ))}
          </div>
          {/* Rows */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
            <div
              key={row}
              className="grid grid-cols-6 border-t border-gray-800"
            >
              <div className="p-2 border-r border-gray-800 text-xs text-gray-500 text-center bg-gray-800/50">
                {row}
              </div>
              {['A', 'B', 'C', 'D', 'E'].map((col) => (
                <div
                  key={col}
                  className="p-2 border-r border-gray-800 last:border-r-0 text-sm text-white min-h-[32px]"
                >
                  {row === 1 && col === 'A' && 'Email Count'}
                  {row === 1 && col === 'B' && 'Status'}
                  {row === 2 && col === 'A' && 'Gmail'}
                  {row === 2 && col === 'B' && 'Persisted ✅'}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-8 text-center">
          Demo - Gmail emails persist across navigation!
        </p>
      </div>
    </ServicePageLayout>
  )
}
