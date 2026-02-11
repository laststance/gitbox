-- ============================================================================
-- GitBox E2E Test Seed Data
-- ============================================================================
--
-- Creates comprehensive test data for E2E tests matching MSW mock structure.
-- Data uses deterministic UUIDs for predictable test assertions.
--
-- UUID Mapping (MSW ID → UUID):
-- - test-user-id-12345 → 00000000-0000-0000-0000-000000000001
-- - board-1            → 00000000-0000-0000-0000-000000000100
-- - board-2            → 00000000-0000-0000-0000-000000000101
-- - status-1~5         → 00000000-0000-0000-0000-000000000201~205
-- - card-1~5           → 00000000-0000-0000-0000-000000000301~305
-- - projinfo-1~4       → 00000000-0000-0000-0000-000000000401~404
-- - maintenance-1~2    → 00000000-0000-0000-0000-000000000501~502
-- - projinfo-maint-1   → 00000000-0000-0000-0000-000000000601
--
-- ============================================================================

-- ============================================================================
-- 1. Create Test User in auth.users
-- ============================================================================

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'test@gitbox.dev',
  crypt('testpassword123', gen_salt('bf')),
  NOW(),
  '2024-01-01T00:00:00.000Z'::timestamptz,
  '2024-01-01T00:00:00.000Z'::timestamptz,
  '{"provider":"github","providers":["github"]}'::jsonb,
  '{
    "avatar_url": "https://avatars.githubusercontent.com/u/12345?v=4",
    "email": "test@gitbox.dev",
    "full_name": "Test User",
    "user_name": "testuser"
  }'::jsonb,
  false,
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Create Boards
-- ============================================================================

-- Board 1: Test Board (main board for most tests)
-- position=1: second in list (created_at DESC puts newer board-2 first)
INSERT INTO board (id, user_id, name, settings, is_favorite, position, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000100'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Test Board',
  '{}'::jsonb,
  false,
  1,
  '2024-01-01T00:00:00.000Z'::timestamptz,
  '2024-01-01T00:00:00.000Z'::timestamptz
)
ON CONFLICT (id) DO NOTHING;

-- Board 2: Work Projects (secondary board)
-- position=0: first in list (newer board appears first, matching created_at DESC legacy order)
INSERT INTO board (id, user_id, name, settings, is_favorite, position, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Work Projects',
  '{}'::jsonb,
  false,
  0,
  '2024-01-02T00:00:00.000Z'::timestamptz,
  '2024-01-02T00:00:00.000Z'::timestamptz
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. Create Status Lists (Kanban Columns)
-- ============================================================================

INSERT INTO statuslist (id, board_id, name, color, "order", grid_row, grid_col, created_at, updated_at)
VALUES
  -- Status 1: Pending (Backlog)
  (
    '00000000-0000-0000-0000-000000000201'::uuid,
    '00000000-0000-0000-0000-000000000100'::uuid,
    'Pending',
    '#8B7355',
    0,
    0,
    0,
    '2024-01-01T00:00:00.000Z'::timestamptz,
    '2024-01-01T00:00:00.000Z'::timestamptz
  ),
  -- Status 2: Planning (To Do)
  (
    '00000000-0000-0000-0000-000000000202'::uuid,
    '00000000-0000-0000-0000-000000000100'::uuid,
    'Planning',
    '#6B8E23',
    1,
    0,
    1,
    '2024-01-01T00:00:00.000Z'::timestamptz,
    '2024-01-01T00:00:00.000Z'::timestamptz
  ),
  -- Status 3: Focus Development (In Progress)
  (
    '00000000-0000-0000-0000-000000000203'::uuid,
    '00000000-0000-0000-0000-000000000100'::uuid,
    'Focus Development',
    '#CD853F',
    2,
    0,
    2,
    '2024-01-01T00:00:00.000Z'::timestamptz,
    '2024-01-01T00:00:00.000Z'::timestamptz
  ),
  -- Status 4: MVP Release (Review)
  (
    '00000000-0000-0000-0000-000000000204'::uuid,
    '00000000-0000-0000-0000-000000000100'::uuid,
    'MVP Release',
    '#4682B4',
    3,
    0,
    3,
    '2024-01-01T00:00:00.000Z'::timestamptz,
    '2024-01-01T00:00:00.000Z'::timestamptz
  ),
  -- Status 5: Production Release (Done)
  (
    '00000000-0000-0000-0000-000000000205'::uuid,
    '00000000-0000-0000-0000-000000000100'::uuid,
    'Production Release',
    '#556B2F',
    4,
    0,
    4,
    '2024-01-01T00:00:00.000Z'::timestamptz,
    '2024-01-01T00:00:00.000Z'::timestamptz
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. Create Repo Cards
-- ============================================================================

INSERT INTO repocard (id, board_id, status_id, repo_owner, repo_name, "order", meta, created_at, updated_at)
VALUES
  -- Card 1: testuser/test-repo (in Planning/To Do)
  (
    '00000000-0000-0000-0000-000000000301'::uuid,
    '00000000-0000-0000-0000-000000000100'::uuid,
    '00000000-0000-0000-0000-000000000202'::uuid,
    'testuser',
    'test-repo',
    0,
    '{
      "stars": 42,
      "language": "TypeScript",
      "topics": ["react", "nextjs"],
      "visibility": "public",
      "description": "A test repository for GitBox",
      "updatedAt": "2024-01-15T00:00:00.000Z"
    }'::jsonb,
    '2024-01-01T00:00:00.000Z'::timestamptz,
    '2024-01-01T00:00:00.000Z'::timestamptz
  ),
  -- Card 2: testuser/another-repo (in Focus Development)
  (
    '00000000-0000-0000-0000-000000000302'::uuid,
    '00000000-0000-0000-0000-000000000100'::uuid,
    '00000000-0000-0000-0000-000000000203'::uuid,
    'testuser',
    'another-repo',
    0,
    '{
      "stars": 128,
      "language": "JavaScript",
      "topics": ["nodejs", "api"],
      "visibility": "public",
      "description": "Another test repository",
      "updatedAt": "2024-01-10T00:00:00.000Z"
    }'::jsonb,
    '2024-01-02T00:00:00.000Z'::timestamptz,
    '2024-01-05T00:00:00.000Z'::timestamptz
  ),
  -- Card 3: laststance/create-react-app-vite (in Pending/Backlog)
  (
    '00000000-0000-0000-0000-000000000303'::uuid,
    '00000000-0000-0000-0000-000000000100'::uuid,
    '00000000-0000-0000-0000-000000000201'::uuid,
    'laststance',
    'create-react-app-vite',
    0,
    '{
      "stars": 500,
      "language": "TypeScript",
      "topics": ["vite", "react", "template"],
      "visibility": "public",
      "description": "Create React App + Vite template",
      "updatedAt": "2024-01-20T00:00:00.000Z"
    }'::jsonb,
    '2024-01-03T00:00:00.000Z'::timestamptz,
    '2024-01-03T00:00:00.000Z'::timestamptz
  ),
  -- Card 4: laststance/nsx (in Planning/To Do) - for intra-column reorder testing
  (
    '00000000-0000-0000-0000-000000000304'::uuid,
    '00000000-0000-0000-0000-000000000100'::uuid,
    '00000000-0000-0000-0000-000000000202'::uuid,
    'laststance',
    'nsx',
    1,
    '{
      "stars": 85,
      "language": "TypeScript",
      "topics": ["cli", "monorepo", "npm"],
      "visibility": "public",
      "description": "Monorepo workspace CLI tool",
      "updatedAt": "2024-01-18T00:00:00.000Z"
    }'::jsonb,
    '2024-01-04T00:00:00.000Z'::timestamptz,
    '2024-01-04T00:00:00.000Z'::timestamptz
  ),
  -- Card 5: laststance/use-app-state (in Planning/To Do) - for intra-column reorder testing
  (
    '00000000-0000-0000-0000-000000000305'::uuid,
    '00000000-0000-0000-0000-000000000100'::uuid,
    '00000000-0000-0000-0000-000000000202'::uuid,
    'laststance',
    'use-app-state',
    2,
    '{
      "stars": 120,
      "language": "TypeScript",
      "topics": ["react", "hooks", "state"],
      "visibility": "public",
      "description": "Simple React state management hook",
      "updatedAt": "2024-01-12T00:00:00.000Z"
    }'::jsonb,
    '2024-01-05T00:00:00.000Z'::timestamptz,
    '2024-01-05T00:00:00.000Z'::timestamptz
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. Create Project Info (Comments, Notes, Links)
-- ============================================================================

INSERT INTO projectinfo (id, repo_card_id, maintenance_id, note, comment, comment_color, links, created_at, updated_at)
VALUES
  -- ProjectInfo 1: For card-1 (testuser/test-repo)
  (
    '00000000-0000-0000-0000-000000000401'::uuid,
    '00000000-0000-0000-0000-000000000301'::uuid,
    NULL,
    'Important project notes here',
    'npmリリース完了、当分は機能追加予定なし',
    'primary',
    '[
      {"title": "Documentation", "url": "https://docs.example.com"},
      {"title": "Staging", "url": "https://staging.example.com"}
    ]'::jsonb,
    '2024-01-01T00:00:00.000Z'::timestamptz,
    '2024-01-01T00:00:00.000Z'::timestamptz
  ),
  -- ProjectInfo 2: For card-2 (testuser/another-repo)
  (
    '00000000-0000-0000-0000-000000000402'::uuid,
    '00000000-0000-0000-0000-000000000302'::uuid,
    NULL,
    'Another repo notes',
    'プロトタイプ作ったけど微妙、差分表示エディタで苦戦中',
    'primary',
    '[]'::jsonb,
    '2024-01-02T00:00:00.000Z'::timestamptz,
    '2024-01-02T00:00:00.000Z'::timestamptz
  ),
  -- ProjectInfo 3: For card-3 (empty comment for testing empty state)
  (
    '00000000-0000-0000-0000-000000000403'::uuid,
    '00000000-0000-0000-0000-000000000303'::uuid,
    NULL,
    '',
    '',
    'primary',
    '[]'::jsonb,
    '2024-01-03T00:00:00.000Z'::timestamptz,
    '2024-01-03T00:00:00.000Z'::timestamptz
  ),
  -- ProjectInfo 4: For card-4 (laststance/nsx)
  (
    '00000000-0000-0000-0000-000000000404'::uuid,
    '00000000-0000-0000-0000-000000000304'::uuid,
    NULL,
    'CLI tool documentation',
    'v2.0リリース準備中',
    'primary',
    '[{"title": "npm", "url": "https://www.npmjs.com/package/nsx"}]'::jsonb,
    '2024-01-04T00:00:00.000Z'::timestamptz,
    '2024-01-04T00:00:00.000Z'::timestamptz
  )
ON CONFLICT (id) DO NOTHING;
-- Note: card-5 intentionally has no projectinfo for testing when projectinfo doesn't exist

-- ============================================================================
-- 6. Create Maintenance Items (Archived Repositories)
-- ============================================================================
-- Note: repo_card_id, note, and hidden columns were dropped in migration
-- 20260101180000_drop_unused_maintenance_columns.sql

INSERT INTO maintenance (id, user_id, repo_owner, repo_name, created_at, updated_at)
VALUES
  -- Maintenance 1: laststance/claude-plugin-dashboard
  (
    '00000000-0000-0000-0000-000000000501'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'laststance',
    'claude-plugin-dashboard',
    '2024-12-31T00:00:00.000Z'::timestamptz,
    '2024-12-31T00:00:00.000Z'::timestamptz
  ),
  -- Maintenance 2: laststance/old-project
  (
    '00000000-0000-0000-0000-000000000502'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'laststance',
    'old-project',
    '2024-11-01T00:00:00.000Z'::timestamptz,
    '2024-11-01T00:00:00.000Z'::timestamptz
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. Create Project Info for Maintenance Items
-- ============================================================================

INSERT INTO projectinfo (id, repo_card_id, maintenance_id, note, comment, comment_color, links, created_at, updated_at)
VALUES
  -- ProjectInfo for maintenance-1
  (
    '00000000-0000-0000-0000-000000000601'::uuid,
    NULL,
    '00000000-0000-0000-0000-000000000501'::uuid,
    'Maintenance notes for dashboard project',
    'Archived - no active development',
    'neutral',
    '[]'::jsonb,
    '2024-12-31T00:00:00.000Z'::timestamptz,
    '2024-12-31T00:00:00.000Z'::timestamptz
  )
ON CONFLICT (id) DO NOTHING;
