'use client'

import { ExternalLink, Globe, Star } from 'lucide-react'
import { memo, useMemo } from 'react'

import { GithubIcon } from '@/components/icons/GithubIcon'
import { Card, CardContent } from '@/components/ui/card'
import type { PublicBoardData } from '@/lib/actions/public-board'
import type { RepoCardDomain, StatusListDomain } from '@/lib/models/domain'

interface PublicBoardClientProps {
  data: PublicBoardData
}

/**
 * Read-only public board view — no authentication, no DnD, no editing.
 * Renders a simple CSS grid Kanban layout with status columns and repo cards.
 */
export const PublicBoardClient = memo(function PublicBoardClient({
  data,
}: PublicBoardClientProps) {
  const { board, statusLists, repoCards } = data

  const gridDimensions = useMemo(() => {
    let maxRow = 0
    let maxCol = 0
    for (const s of statusLists) {
      if (s.gridRow > maxRow) maxRow = s.gridRow
      if (s.gridCol > maxCol) maxCol = s.gridCol
    }
    return { maxRow, maxCol }
  }, [statusLists])

  const cardsByStatus = useMemo(() => {
    const grouped: Record<string, RepoCardDomain[]> = {}
    for (const card of repoCards) {
      const arr = grouped[card.statusId] ?? (grouped[card.statusId] = [])
      arr.push(card)
    }
    return grouped
  }, [repoCards])

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Globe className="text-muted-foreground h-5 w-5" />
          <h1 className="text-foreground text-xl font-bold">{board.name}</h1>
          <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
            Public
          </span>
        </div>
        {board.subtitle && (
          <p className="text-muted-foreground mt-1 text-sm">{board.subtitle}</p>
        )}
      </header>

      {/* Board Grid */}
      <main className="overflow-x-auto p-6">
        <div
          className="grid w-fit min-w-full gap-4"
          style={{
            gridTemplateColumns: `repeat(${gridDimensions.maxCol + 1}, minmax(280px, 320px))`,
            gridTemplateRows: `repeat(${gridDimensions.maxRow + 1}, minmax(min-content, auto))`,
          }}
        >
          {statusLists.map((status) => (
            <PublicColumn
              key={status.id}
              status={status}
              cards={cardsByStatus[status.id] ?? []}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Created with{' '}
            <a
              href="https://gitbox-laststance.vercel.app"
              className="text-foreground hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitBox
            </a>
          </p>
          <a
            href="https://gitbox-laststance.vercel.app"
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
          >
            Create your own board
          </a>
        </div>
      </footer>
    </div>
  )
})

// ─── Column ──────────────────────────────────────────────

interface PublicColumnProps {
  status: StatusListDomain
  cards: RepoCardDomain[]
}

const PublicColumn = memo(function PublicColumn({
  status,
  cards,
}: PublicColumnProps) {
  return (
    <div
      className="bg-muted/50 flex min-h-[200px] flex-col rounded-xl border p-3"
      style={{
        gridRow: status.gridRow + 1,
        gridColumn: status.gridCol + 1,
      }}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2 px-1">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <h2 className="text-foreground text-sm font-semibold">
          {status.title}
        </h2>
        <span className="text-muted-foreground ml-auto text-xs">
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <PublicRepoCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
})

// ─── Card ────────────────────────────────────────────────

interface PublicRepoCardProps {
  card: RepoCardDomain
}

const PublicRepoCard = memo(function PublicRepoCard({
  card,
}: PublicRepoCardProps) {
  const repoUrl = `https://github.com/${card.repoOwner}/${card.repoName}`

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground group-hover:text-primary inline-flex items-center gap-1 text-sm font-medium"
            >
              <GithubIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{card.title}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
            {card.description && (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                {card.description}
              </p>
            )}
          </div>
        </div>

        {/* Metadata */}
        {(card.meta.stars || card.meta.language) && (
          <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
            {card.meta.language && (
              <span className="flex items-center gap-1">
                <span className="bg-primary h-2 w-2 rounded-full" />
                {card.meta.language}
              </span>
            )}
            {typeof card.meta.stars === 'number' && card.meta.stars > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3" />
                {card.meta.stars.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
