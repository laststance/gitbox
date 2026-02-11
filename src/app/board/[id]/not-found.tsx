import Link from 'next/link'
import { memo } from 'react'

import { Button } from '@/components/ui/button'

/**
 * Custom 404 page for invalid board IDs.
 * Shown when notFound() is called from the board page.
 */
const BoardNotFound = memo(function BoardNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <h2 className="text-foreground text-xl font-semibold">
          Board not found
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          This board doesn&apos;t exist or has been deleted.
        </p>
      </div>
      <Button asChild variant="default">
        <Link href="/boards">Go to Boards</Link>
      </Button>
    </div>
  )
})

export default BoardNotFound
