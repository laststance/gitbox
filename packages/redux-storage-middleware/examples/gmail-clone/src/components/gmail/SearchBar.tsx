'use client'

/**
 * Gmail-style Search Bar Component
 */

import { memo, useCallback } from 'react'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { setSearchQuery } from '@/lib/features/emails/emailSlice'

function SearchBar() {
  const dispatch = useAppDispatch()
  const searchQuery = useAppSelector((state) => state.emails.searchQuery)

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setSearchQuery(e.target.value))
    },
    [dispatch],
  )

  const handleClear = useCallback(() => {
    dispatch(setSearchQuery(''))
  }, [dispatch])

  return (
    <div className="relative flex-1 max-w-2xl">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search mail..."
        value={searchQuery}
        onChange={handleSearch}
        className="pl-10 pr-10 bg-slate-100 border-none focus-visible:ring-1"
      />
      {searchQuery && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export default memo(SearchBar)
