/**
 * Maintenance Mode Client Component
 *
 * Explorer UI with Grid/List view toggle
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Grid3X3,
  List,
  Search,
  ExternalLink,
  RotateCcw,
  MoreVertical,
  Archive,
  ArrowUpDown,
  Calendar,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface MaintenanceRepo {
  id: string
  repo_owner: string
  repo_name: string
  note: string | null
  meta: {
    stars?: number
    language?: string
    lastUpdated?: string
  } | null
  created_at: string | null
  updated_at: string | null
  board?: {
    name: string
  } | null
}

interface MaintenanceClientProps {
  repos: MaintenanceRepo[]
}

type ViewMode = 'grid' | 'list'
type SortOption = 'name' | 'updated' | 'stars'

export function MaintenanceClient({ repos }: MaintenanceClientProps) {
  const _router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('updated')
  const [sortAsc, setSortAsc] = useState(false)

  // Filter repos based on search
  const filteredRepos = repos.filter(
    (repo) =>
      `${repo.repo_owner}/${repo.repo_name}`
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      repo.note?.toLowerCase().includes(search.toLowerCase()),
  )

  // Sort repos
  const sortedRepos = [...filteredRepos].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = `${a.repo_owner}/${a.repo_name}`.localeCompare(
          `${b.repo_owner}/${b.repo_name}`,
        )
        break
      case 'updated':
        comparison =
          new Date(b.updated_at || 0).getTime() -
          new Date(a.updated_at || 0).getTime()
        break
      case 'stars':
        comparison = (b.meta?.stars || 0) - (a.meta?.stars || 0)
        break
    }
    return sortAsc ? -comparison : comparison
  })

  const handleOpenGitHub = useCallback((repo: MaintenanceRepo) => {
    window.open(
      `https://github.com/${repo.repo_owner}/${repo.repo_name}`,
      '_blank',
    )
  }, [])

  const handleRestore = useCallback(async (repoId: string) => {
    // TODO: Implement restore to board action
    console.log('Restore to board:', repoId)
    alert('Restore to Board functionality will be implemented')
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Maintenance Mode
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Archived and maintenance projects • {repos.length} items
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('name')}>
                  Name {sortBy === 'name' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('updated')}>
                  Last Updated {sortBy === 'updated' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('stars')}>
                  Stars {sortBy === 'stars' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortAsc(!sortAsc)}>
                  {sortAsc ? 'Ascending' : 'Descending'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Toggle */}
            <div className="flex rounded-lg border border-border p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'rounded-md p-2 transition-colors',
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'rounded-md p-2 transition-colors',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {sortedRepos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Archive className="h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              {search ? 'No matching repositories' : 'No maintenance projects'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? 'Try adjusting your search terms'
                : 'Move projects here from your boards when they are archived'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {viewMode === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedRepos.map((repo, index) => (
                  <motion.div
                    key={repo.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleOpenGitHub(repo)}
                  >
                    {/* Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button className="absolute right-2 top-2 rounded-md p-1.5 opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleOpenGitHub(repo)}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open on GitHub
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRestore(repo.id)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore to Board
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Content */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-foreground truncate pr-8">
                        {repo.repo_name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {repo.repo_owner}
                      </p>
                      {repo.note && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {repo.note}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
                        {repo.meta?.stars !== undefined && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {repo.meta.stars}
                          </span>
                        )}
                        {repo.meta?.language && (
                          <span>{repo.meta.language}</span>
                        )}
                        {repo.updated_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(repo.updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {sortedRepos.map((repo, index) => (
                  <motion.div
                    key={repo.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03 }}
                    className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => handleOpenGitHub(repo)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">
                          {repo.repo_owner}/{repo.repo_name}
                        </h3>
                        {repo.meta?.language && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {repo.meta.language}
                          </span>
                        )}
                      </div>
                      {repo.note && (
                        <p className="mt-1 text-sm text-muted-foreground truncate">
                          {repo.note}
                        </p>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {repo.meta?.stars !== undefined && (
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4" />
                          {repo.meta.stars}
                        </span>
                      )}
                      {repo.updated_at && (
                        <span className="hidden sm:inline">
                          {new Date(repo.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenGitHub(repo)
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRestore(repo.id)
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  )
}
