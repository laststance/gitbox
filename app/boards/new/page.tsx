/**
 * Create New Board Page
 *
 * PRD: Board作成画面
 * - ボード名入力
 * - テーマ選択 (12テーマ)
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateBoardForm } from './CreateBoardForm'

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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-lg">
          <h1 className="text-3xl font-bold text-foreground text-center">
            Create New Board
          </h1>
          <p className="mt-2 text-muted-foreground text-center">
            Give your board a name and choose a theme
          </p>

          <div className="mt-8">
            <CreateBoardForm />
          </div>
        </div>
      </div>
    </div>
  )
}
