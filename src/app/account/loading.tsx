import { memo } from 'react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for account page.
 * Built from the parts {@link AccountClient} is built from, section by
 * section (header, Profile, Account Data, Danger Zone, actions), so every
 * block stands where the loaded one will: nothing moves when the data
 * arrives. A change to the layout of AccountClient belongs here too.
 */
const Loading = memo(function Loading() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8" role="status">
      <span className="sr-only">Loading account</span>

      {/* Header: title (text-3xl) and one line of text */}
      <div className="mb-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-2 h-6 w-72 max-w-full" />
      </div>

      <div className="space-y-6">
        {/* Profile: card header, avatar row, "Linked since" row */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-5 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 shrink-0 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <div className="border-t pt-4">
              <Skeleton className="h-5 w-48" />
            </div>
          </CardContent>
        </Card>

        {/* Account Data: card header and two tiles (Boards, Repository Cards) */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-5 w-48 max-w-full" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center rounded-lg border p-4"
                >
                  <Skeleton className="mb-2 size-6" />
                  <Skeleton className="h-8 w-10" />
                  <Skeleton className="mt-1 h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone: card header, the notice box, the button */}
        <Card className="border-destructive">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-64 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-destructive/20 space-y-1 rounded-lg border p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-3 h-4 w-64 max-w-full" />
            </div>
            <Skeleton className="h-9 w-36" />
          </CardContent>
        </Card>

        {/* Actions: Back to Boards, Sign Out */}
        <div className="flex justify-between pt-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </div>
  )
})

export default Loading
