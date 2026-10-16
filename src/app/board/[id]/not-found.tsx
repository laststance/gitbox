import Link from 'next/link'
import { memo } from 'react'

import { Button } from '@/components/ui/button'

/**
 * Custom 404 page for a board the signed-in user cannot open here.
 * Shown when notFound() is called from the board page: the ID is malformed,
 * no such board exists, or the board belongs to another account.
 */
const BoardNotFound = memo(function BoardNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <h2 className="text-foreground text-xl font-semibold">
          Board not found
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          This board doesn&apos;t exist, was deleted, or belongs to another
          account.
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          A board opens only for the account that owns it.
        </p>
      </div>
      <Button asChild variant="default">
        <Link href="/boards">Go to Boards</Link>
      </Button>
    </div>
  )
})

export default BoardNotFound
