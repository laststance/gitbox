/**
 * Maintenance Mode Page
 *
 * PRD 3.3: 完了・保守中のプロジェクト保管庫
 * - Explorer UI (Grid/List切替)
 * - 並び替え/検索
 * - クリック = GitHub repo へ遷移
 * - Restore to Board 操作
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MaintenanceClient } from './MaintenanceClient';

export default async function MaintenancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch maintenance mode repos (in_maintenance = true)
  const { data: maintenanceRepos, error } = await supabase
    .from('repocard')
    .select(`
      *,
      board:board_id (name)
    `)
    .eq('in_maintenance', true)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch maintenance repos:', error);
  }

  return (
    <MaintenanceClient
      repos={maintenanceRepos || []}
    />
  );
}

