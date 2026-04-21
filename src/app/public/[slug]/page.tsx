import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { getPublicBoardBySlug } from '@/lib/actions/public-board'
import { toPublicBoardSlug } from '@/lib/types/brands'

import { PublicBoardClient } from './PublicBoardClient'

interface PublicBoardPageProps {
  params: Promise<{ slug: string }>
}

/** Deduplicate fetches within the same request (generateMetadata + page) */
const getCachedPublicBoard = cache(async (slug: string) =>
  getPublicBoardBySlug(toPublicBoardSlug(slug)),
)

/**
 * Generate metadata for public board SEO.
 *
 * @param props - Next.js page props with slug param
 * @returns Metadata with board name as title
 */
export async function generateMetadata(
  props: PublicBoardPageProps,
): Promise<Metadata> {
  const { slug } = await props.params
  const data = await getCachedPublicBoard(slug)

  if (!data) {
    return { title: 'Board Not Found' }
  }

  return {
    title: `${data.board.name} — GitBox`,
    description: data.board.subtitle || `Public board shared via GitBox`,
  }
}

/**
 * Public board page — read-only view accessible without authentication.
 * Uses RLS `is_public = true` policy for data access.
 */
export default async function PublicBoardPage(props: PublicBoardPageProps) {
  const { slug } = await props.params
  const data = await getCachedPublicBoard(slug)

  if (!data) {
    notFound()
  }

  return <PublicBoardClient data={data} />
}
