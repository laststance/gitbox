'use client'

import React from 'react'

import { CTASection } from './(landing)/CTASection'
import { FeaturesSection } from './(landing)/FeaturesSection'
import { Footer } from './(landing)/Footer'
import { HeroSection } from './(landing)/HeroSection'
import { HowItWorksSection } from './(landing)/HowItWorksSection'
import { Navigation } from './(landing)/Navigation'

/**
 * GitBox Landing Page
 *
 * Thin composition of section components.
 * Each section is in src/app/(landing)/ with 'use client' directive.
 */
function GitBoxLandingPage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CTASection />
      <Footer />
    </div>
  )
}

export default GitBoxLandingPage
