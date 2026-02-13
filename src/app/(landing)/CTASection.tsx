'use client'

import { ArrowRight, Github } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { memo } from 'react'

import { Button } from '@/components/ui/button'

import { Glow } from './Glow'

/**
 * Call-to-action section with GitHub sign-in button and center glow effect.
 */
export const CTASection = memo(function CTASection() {
  const router = useRouter()

  return (
    <section className="relative overflow-hidden px-6 py-24">
      <div className="from-primary/10 via-background to-primary/5 absolute inset-0 bg-linear-to-br" />
      <Glow variant="center" className="opacity-30" />

      <div className="relative z-10 mx-auto max-w-4xl space-y-8 text-center">
        <h2 className="from-foreground to-muted-foreground bg-linear-to-b bg-clip-text text-3xl font-bold text-transparent md:text-4xl lg:text-5xl">
          Ready to Organize Your Repos?
        </h2>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg md:text-xl">
          Start managing your GitHub repositories visually. It&apos;s free, open
          source, and your data stays with you.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Button
            variant="github"
            size="xl"
            className="min-h-14 gap-2"
            onClick={() => router.push('/login')}
          >
            <Github className="h-5 w-5" />
            Get Started with GitHub
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  )
})
