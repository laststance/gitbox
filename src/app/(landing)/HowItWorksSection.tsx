'use client'

import React, { memo } from 'react'

/**
 * Four-step "How It Works" section with numbered process cards.
 */
export const HowItWorksSection = memo(function HowItWorksSection() {
  const steps = [
    {
      step: '01',
      title: 'Connect GitHub',
      description:
        'Sign in with your GitHub account. We only request read access to your public profile and repositories.',
    },
    {
      step: '02',
      title: 'Create Your Board',
      description:
        'Set up a Kanban board with custom status columns that match your workflow.',
    },
    {
      step: '03',
      title: 'Add Repositories',
      description:
        'Search and add your GitHub repositories to the board. Organize them by dragging between columns.',
    },
    {
      step: '04',
      title: 'Stay Organized',
      description:
        'Add notes, links, and credentials. Track progress and keep your projects under control.',
    },
  ]

  return (
    <section id="how-it-works" className="relative px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <h2 className="from-foreground to-muted-foreground mb-4 bg-linear-to-b bg-clip-text text-3xl font-bold text-transparent md:text-4xl lg:text-5xl">
            How It Works
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Get started in minutes with a simple setup process
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {steps.map((item, index) => (
            <div
              key={index}
              className="group border-border/50 bg-background/30 hover:bg-background/60 hover:border-primary/20 relative flex cursor-pointer gap-4 rounded-xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold transition-transform duration-300 group-hover:scale-110">
                {item.step}
              </div>
              <div>
                <h3 className="text-foreground mb-1 text-lg font-semibold">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
})
