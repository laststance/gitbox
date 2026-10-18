import type { Metadata } from 'next'

import { CTASection } from './(landing)/CTASection'
import { FeaturesSection } from './(landing)/FeaturesSection'
import { landingDisplay } from './(landing)/fonts'
import { Footer } from './(landing)/Footer'
import { HeroSection } from './(landing)/HeroSection'
import { HowItWorksSection } from './(landing)/HowItWorksSection'
import { Navigation } from './(landing)/Navigation'

export const metadata: Metadata = {
  title: 'GitBox - GitHub Repository Manager',
  description:
    'Manage your GitHub repositories in Kanban board format. Visualize, organize, and track your projects efficiently.',
}

/**
 * GitBox Landing Page
 *
 * Thin composition of section components.
 * Sections live in src/app/(landing)/. {@link landingDisplay} is applied
 * here so signed-in layouts do not download Source Serif 4.
 */
function GitBoxLandingPage() {
  return (
    <div
      className={`${landingDisplay.variable} bg-background text-foreground min-h-screen`}
    >
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
