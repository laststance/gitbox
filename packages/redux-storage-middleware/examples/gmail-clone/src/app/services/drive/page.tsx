'use client'

import ServicePageLayout from '@/components/services/ServicePageLayout'

const DriveIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path fill="#FBBC05" d="M8 16l-4-7 4-7h8l4 7-4 7z" />
    <path fill="#4285F4" d="M4 9l4 7h12l-4-7z" />
    <path fill="#34A853" d="M16 2l4 7H8l4-7z" />
  </svg>
)

const files = [
  { name: 'Project Docs', type: 'folder', color: '#FBBC05' },
  { name: 'localStorage Demo.docx', type: 'doc', color: '#4285F4' },
  { name: 'Performance Report.xlsx', type: 'sheet', color: '#34A853' },
  { name: 'Presentation.pptx', type: 'slides', color: '#EA4335' },
]

export default function DrivePage() {
  return (
    <ServicePageLayout
      serviceName="Drive"
      serviceIcon={DriveIcon}
      serviceColor="#FBBC05"
    >
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-medium text-white mb-6">My Drive</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {files.map((file, i) => (
            <div
              key={i}
              className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer text-center"
            >
              <div
                className="w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${file.color}20` }}
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill={file.color}>
                  {file.type === 'folder' ? (
                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  ) : (
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                  )}
                </svg>
              </div>
              <p className="text-sm text-white truncate">{file.name}</p>
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
