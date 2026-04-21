/**
 * Login Page
 *
 * Sign in with GitHub OAuth
 * - Landing page with "Sign in with GitHub" button
 * - Simple and clean design
 * - Accessibility support (keyboard navigation)
 */

import type { Metadata } from 'next'
import Link from 'next/link'

import { GithubIcon } from '@/components/icons/GithubIcon'
import { signInWithGitHub } from '@/lib/actions/auth'

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to GitBox with your GitHub account',
}

export default function LoginPage() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center">
      <div className="bg-card w-full max-w-md space-y-8 rounded-xl p-8 shadow-lg">
        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="text-foreground text-4xl font-bold">GitBox</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Manage GitHub repositories in Kanban format
          </p>
        </div>

        {/* Login Form */}
        <div className="mt-8">
          <form action={signInWithGitHub}>
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3 transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
            >
              <GithubIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-semibold">Sign in with GitHub</span>
            </button>
          </form>

          {/* Additional Info */}
          <p className="text-muted-foreground mt-4 text-center text-xs">
            By signing in, you agree to our{' '}
            <Link
              href="/terms"
              className="text-primary hover:text-primary/80 hover:underline"
            >
              Terms of Use
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy"
              className="text-primary hover:text-primary/80 hover:underline"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
