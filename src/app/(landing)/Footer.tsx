'use client'

import { Columns3 } from 'lucide-react'
import Link from 'next/link'
import { memo } from 'react'

import { GithubIcon } from '@/components/icons/GithubIcon'

/**
 * Simple footer with logo, GitHub link, and credits.
 */
export const Footer = memo(function Footer() {
  return (
    <footer className="border-border/50 border-t px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="bg-primary flex h-6 w-6 items-center justify-center rounded">
            <Columns3 className="text-primary-foreground h-4 w-4" />
          </div>
          <span className="text-foreground text-sm font-medium">GitBox</span>
        </div>
        <div className="text-muted-foreground flex items-center gap-6 text-sm">
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-foreground transition-colors"
          >
            Terms
          </Link>
          <a
            href="https://github.com/laststance/gitbox"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <GithubIcon className="h-4 w-4" />
            GitHub
          </a>
          <span>
            Made by{' '}
            <a
              href="https://laststance.io/"
              target="_blank"
              className="hover:text-foreground transition-colors"
            >
              Laststance.io
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
})
