'use client'

import { ExternalLink, Menu, X, Columns3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { memo, useState } from 'react'

import { GithubIcon } from '@/components/icons/GithubIcon'
import { Button } from '@/components/ui/button'

/**
 * Fixed top navigation bar with desktop/mobile menus and GitHub sign-in CTA.
 */
export const Navigation = memo(function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()

  const handleSignIn = () => {
    router.push('/login')
  }

  return (
    <header className="border-border/50 bg-background/80 fixed top-0 z-50 w-full border-b backdrop-blur-md">
      <nav className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <Columns3 className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="text-foreground text-xl font-semibold">
              GitBox
            </span>
          </div>

          <div className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-8 md:flex">
            <a
              href="#features"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              How It Works
            </a>
            <a
              href="https://github.com/laststance/gitbox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <Button variant="github" size="default" onClick={handleSignIn}>
              <GithubIcon className="mr-2 h-4 w-4" />
              Sign in with GitHub
            </Button>
          </div>

          <button
            type="button"
            className="text-foreground flex min-h-11 min-w-11 items-center justify-center md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="bg-background/95 border-border/50 border-t backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-4 px-6 py-4">
            <a
              href="#features"
              className="text-muted-foreground hover:text-foreground py-2 text-sm transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-muted-foreground hover:text-foreground py-2 text-sm transition-colors"
            >
              How It Works
            </a>
            <a
              href="https://github.com/laststance/gitbox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 py-2 text-sm transition-colors"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
            <div className="border-border/50 border-t pt-4">
              <Button
                variant="github"
                size="default"
                className="w-full"
                onClick={handleSignIn}
              >
                <GithubIcon className="mr-2 h-4 w-4" />
                Sign in with GitHub
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
})
