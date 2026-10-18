'use client'

import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { memo, useState, useEffect } from 'react'

import { GithubIcon } from '@/components/icons/GithubIcon'
import { Button } from '@/components/ui/button'
import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'

import { Glow } from './Glow'
import { KanbanPreview } from './KanbanPreview'

/**
 * Landing hero section with mouse-follow glow, product headline,
 * CTA buttons, and embedded KanbanPreview.
 */
export const HeroSection = memo(function HeroSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const router = useRouter()

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      const heroElement = document.getElementById('hero-section')
      if (heroElement) {
        const rect = heroElement.getBoundingClientRect()
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      }
    }

    const heroElement = document.getElementById('hero-section')
    if (heroElement) {
      heroElement.addEventListener('mousemove', handleMouseMove)
      return (): void =>
        heroElement.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <section
      id="hero-section"
      className="from-background via-background to-muted relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br px-6 py-32"
    >
      {/* Background Grid */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--foreground) / 0.1) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--foreground) / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Mouse Follow Glow */}
      <div
        className="pointer-events-none absolute z-0 transition-opacity duration-300"
        style={{
          left: mousePosition.x,
          top: mousePosition.y,
          width: '300px',
          height: '300px',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)',
        }}
      />

      <Glow variant="center" className="opacity-40" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center space-y-8 text-center">
        <h1 className="text-foreground font-[family-name:var(--font-landing-display)] text-4xl leading-tight font-bold sm:text-5xl md:text-6xl lg:text-7xl">
          Your GitHub repositories,
          <br />
          <span className="text-primary">on a Kanban board</span>
        </h1>

        <p className="text-muted-foreground max-w-2xl text-lg md:text-xl">
          Organize your GitHub repositories in a beautiful Kanban board.
          Drag-and-drop to track progress, add notes, and keep your projects
          under control.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Button
            variant="github"
            size="xl"
            className="min-h-14 gap-2"
            onClick={() => router.push('/login')}
          >
            <GithubIcon className="h-5 w-5" />
            Sign in with GitHub
            <ArrowRight className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="min-h-12 gap-2"
            onClick={() => {
              document
                .getElementById('features')
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Learn More
          </Button>
        </div>

        <p className="text-muted-foreground/70 text-sm">
          Free and open source. Your data stays with you.
        </p>
      </div>

      {/* Kanban Preview */}
      <div className="w-full">
        <KanbanPreview />
      </div>
    </section>
  )
}, areServerRenderedPropsEqual)
