import { Columns3 } from 'lucide-react'
import Link from 'next/link'
import { memo } from 'react'

import { Button } from '@/components/ui/button'

/**
 * 404 page for a shared board link that shows no board. Shown when
 * notFound() is called from the public board page: the slug is malformed or
 * unknown, or the owner stopped sharing the board. Exists because visitors
 * here usually have no account, and the root 404 page offers them "Go to
 * Boards", which only leads to the login page.
 */
const PublicBoardNotFound = memo(function PublicBoardNotFound() {
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
          This shared board isn&apos;t available.
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          The link may be mistyped, or the owner stopped sharing the board.
        </p>
      </div>

      <Button asChild variant="default">
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  )
})

export default PublicBoardNotFound
