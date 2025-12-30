'use client'

import ServicePageLayout from '@/components/services/ServicePageLayout'

const NewsIcon = (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <rect fill="#4285F4" x="3" y="3" width="18" height="18" rx="2" />
    <rect fill="#fff" x="5" y="5" width="6" height="6" />
    <rect fill="#fff" x="13" y="5" width="6" height="2" />
    <rect fill="#fff" x="13" y="9" width="6" height="2" />
    <rect fill="#fff" x="5" y="13" width="14" height="2" />
    <rect fill="#fff" x="5" y="17" width="10" height="2" />
  </svg>
)

const articles = [
  {
    title: 'Redux Storage Middleware Released',
    source: 'Tech News',
    time: '2h ago',
  },
  {
    title: 'localStorage vs IndexedDB: A Deep Dive',
    source: 'Dev Weekly',
    time: '4h ago',
  },
  {
    title: 'Next.js 16 Brings New Features',
    source: 'JavaScript Daily',
    time: '6h ago',
  },
  {
    title: 'State Management Best Practices 2025',
    source: 'React Blog',
    time: '8h ago',
  },
]

export default function NewsPage() {
  return (
    <ServicePageLayout
      serviceName="News"
      serviceIcon={NewsIcon}
      serviceColor="#4285F4"
    >
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-medium text-white mb-6">Top Stories</h1>
        <div className="space-y-4">
          {articles.map((article, i) => (
            <div
              key={i}
              className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
            >
              <h2 className="text-lg text-white font-medium mb-2">
                {article.title}
              </h2>
              <p className="text-sm text-gray-500">
                {article.source} • {article.time}
              </p>
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
