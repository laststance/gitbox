/**
 * Board Detail Page
 *
 * Displays an individual Kanban board.
 * - Fetches the board + its columns, cards, and comments in ONE PostgREST
 *   embed via getBoardBundle (deduped across generateMetadata + page with
 *   React.cache).
 * - Fetches user-scoped maintenance identifiers in parallel.
 * - Renders BoardPageClient with the server-fetched data.
 */

import { type Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import {
  getBoardBundle,
  getUserMaintenanceRepoIdentifiers,
  type BoardInitialData,
} from '@/lib/actions/board-data'

import { BoardPageClient } from './BoardPageClient'

export interface BoardPageProps {
  params: Promise<{
    id: string
  }>
}

/** Deduplicate the board embed within one request (generateMetadata + page). */
const getCachedBoardBundle = cache(async (id: string) => getBoardBundle(id))

/**
 * generateMetadata
 *
 * Sets the board name as the page title. Reuses the request-cached bundle so
 * this does NOT trigger a second board fetch.
 */
export async function generateMetadata(
  props: BoardPageProps,
): Promise<Metadata> {
  const params = await props.params
  const bundle = await getCachedBoardBundle(params.id)

  return {
    title: bundle?.board.name ?? 'Board',
  }
}

/**
 * BoardPage
 *
 * Kanban board detail page.
 * - Returns 404 if the board does not exist or RLS hides it from this user.
 * - User authentication is enforced upstream in proxy.ts.
 * - Fetches the board embed (request-cached) and maintenance identifiers in
 *   parallel, then hands render-ready data to BoardPageClient.
 */
export default async function BoardPage(props: BoardPageProps) {
  const params = await props.params

  // The board embed is request-cached, so this awaits the same promise that
  // generateMetadata already kicked off; maintenance ids resolve alongside it.
  const [bundle, maintenanceRepoIdentifiers] = await Promise.all([
    getCachedBoardBundle(params.id),
    getUserMaintenanceRepoIdentifiers(),
  ])

  // Return 404 if the board does not exist or the user lacks access.
  if (!bundle) {
    notFound()
  }

  const initialData: BoardInitialData = {
    statusLists: bundle.statusLists,
    repoCards: bundle.repoCards,
    comments: bundle.comments,
    maintenanceRepoIdentifiers,
  }

  return <BoardPageClient board={bundle.board} initialData={initialData} />
}
