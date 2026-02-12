'use client'

import { Columns3, GripVertical, FileText, Archive } from 'lucide-react'
import React, { memo, useSyncExternalStore } from 'react'

const FEATURE_SUBTITLES = [
  'Tame the repo chaos from AI-powered development',
  'Your repos multiply faster than ever. We help you stay organized.',
  'Ship fast with AI. Stay organized with GitBox.',
  'In the age of vibe coding, chaos needs a home.',
  'Build more than ever. Lose track of nothing.',
] as const

/** Module-level cache for random subtitle index */
let clientSubtitleIndex: number | null = null

/**
 * Get client snapshot for subtitle index.
 * @returns Random subtitle index (cached after first call)
 */
const getClientSubtitleSnapshot = () => {
  if (clientSubtitleIndex === null) {
    clientSubtitleIndex = Math.floor(Math.random() * FEATURE_SUBTITLES.length)
  }
  return clientSubtitleIndex
}

/**
 * Server snapshot returns 0 for consistent SSR output.
 * @returns 0
 */
const getServerSubtitleSnapshot = () => 0

/** No-op subscribe for useSyncExternalStore */
const emptySubtitleSubscribe = () => () => {}

/**
 * Features section with 4 feature cards and an SSR-safe random subtitle.
 */
export const FeaturesSection = memo(function FeaturesSection() {
  const subtitleIndex = useSyncExternalStore(
    emptySubtitleSubscribe,
    getClientSubtitleSnapshot,
    getServerSubtitleSnapshot,
  )

  const features = [
    {
      icon: <Columns3 className="h-8 w-8" />,
      title: 'Kanban Board',
      description:
        'Visual status-based organization for your ever-growing collection of repositories. Create custom columns like Backlog, In Progress, Review, and Done.',
    },
    {
      icon: <GripVertical className="h-8 w-8" />,
      title: 'Drag & Drop',
      description:
        'Intuitive reordering and status changes. Simply drag repositories between columns to update their status instantly.',
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: 'Project Info',
      description:
        'Add quick notes, important links, and secure credentials to each repository. Keep all project context in one place.',
    },
    {
      icon: <Archive className="h-8 w-8" />,
      title: 'Maintenance Mode',
      description:
        'Archive completed or experimental projects. Keep your board clean while preserving historical data.',
    },
  ]

  return (
    <section id="features" className="bg-muted/30 relative px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <h2 className="from-foreground to-muted-foreground mb-4 bg-linear-to-b bg-clip-text text-3xl font-bold text-transparent md:text-4xl lg:text-5xl">
            For AI Era Developers
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            {FEATURE_SUBTITLES[subtitleIndex]}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group border-border bg-background/50 hover:bg-background hover:border-primary/20 relative rounded-2xl border p-8 backdrop-blur-sm transition-all duration-300 hover:shadow-lg"
            >
              <div className="text-primary mb-4 transition-transform duration-300 group-hover:scale-110">
                {feature.icon}
              </div>
              <h3 className="text-foreground mb-2 text-xl font-semibold">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
})
