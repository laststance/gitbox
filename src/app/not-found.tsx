import { Columns3 } from 'lucide-react'
import Link from 'next/link'
import { memo } from 'react'

import { Button } from '@/components/ui/button'

/**
 * Root 404 page for unmatched routes.
 * Displayed when authenticated users navigate to URLs that don't exist.
 * Unauthenticated users are redirected to /login by proxy.ts before reaching this page.
 */
const NotFound = memo(function NotFound() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      {/* Faded brand icon */}
      <div className="text-muted-foreground/20">
        <Columns3 className="h-24 w-24" strokeWidth={1} />
      </div>

      <div className="text-center">
        <h1 className="text-foreground text-6xl font-bold tracking-tight">
          404
        </h1>
        <p className="text-muted-foreground mt-3 text-lg">
          This page doesn&apos;t exist or has been moved.
        </p>
      </div>

      <div className="flex gap-3">
        <Button asChild variant="default">
          <Link href="/boards">Go to Boards</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  )
})

export default NotFound
