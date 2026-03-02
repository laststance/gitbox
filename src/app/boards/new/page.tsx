/**
 * Create New Board Page
 *
 * PRD: Board creation screen
 * - Board name input
 * - Theme selection (14 themes)
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { CreateBoardForm } from './CreateBoardForm'

export const metadata: Metadata = {
  title: 'Create Board',
  description: 'Create a new Kanban board for your GitHub repositories',
}

export default async function NewBoardPage() {
  const supabase = await createClient()

  // Authentication check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-foreground text-center text-3xl font-bold">
            Create New Board
          </h1>
          <p className="text-muted-foreground mt-2 text-center">
            Give your board a name and choose a template
          </p>

          <div className="mt-8">
            <CreateBoardForm />
          </div>
        </div>
      </div>
    </div>
  )
}
