'use client'

import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { memo, useState, useEffect } from 'react'

import { GithubIcon } from '@/components/icons/GithubIcon'
import { Button } from '@/components/ui/button'

import { Glow } from './Glow'
import { KanbanPreview } from './KanbanPreview'

/**
 * Landing hero section with mouse-follow glow, animated headline,
 * CTA buttons, and embedded KanbanPreview.
 */
export const HeroSection = memo(function HeroSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const router = useRouter()

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
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
      return () => heroElement.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <section
      id="hero-section"
      className="from-background via-background to-muted relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br px-6 py-32"
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
        .animate-fade-in-scale {
          animation: fadeInScale 0.8s ease-out forwards;
        }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-500 { animation-delay: 500ms; }
      `}</style>

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
        <h1 className="animate-fade-in from-foreground via-foreground to-muted-foreground bg-linear-to-b bg-clip-text text-4xl leading-tight font-bold text-transparent opacity-0 delay-100 sm:text-5xl md:text-6xl lg:text-7xl">
          Manage GitHub Repos
          <br />
          <span className="text-primary">Like Never Before</span>
        </h1>

        <p className="animate-fade-in text-muted-foreground max-w-2xl text-lg opacity-0 delay-200 md:text-xl">
          Organize your GitHub repositories in a beautiful Kanban board.
          Drag-and-drop to track progress, add notes, and keep your projects
          under control.
        </p>

        <div className="animate-fade-in flex flex-wrap items-center justify-center gap-4 pt-4 opacity-0 delay-300">
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

        <p className="animate-fade-in text-muted-foreground/70 text-sm opacity-0 delay-500">
          Free and open source. Your data stays with you.
        </p>
      </div>

      {/* Kanban Preview */}
      <div className="animate-fade-in w-full opacity-0 delay-500">
        <KanbanPreview />
      </div>
    </section>
  )
})
