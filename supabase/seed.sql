-- Test Data for E2E Tests
-- Creates a test user, board, status lists, and repo cards

-- Note: Must create user in auth.users first due to foreign key constraint

-- 1. Create test user in auth.users
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
  'test@example.com',
  crypt('testpassword123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false,
  'authenticated',
  'authenticated'
);

-- 2. Create test board
INSERT INTO board (id, user_id, name, theme, settings, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000100'::uuid, -- Test board ID
  '00000000-0000-0000-0000-000000000001'::uuid, -- Test user ID
  'Test Board',
  'sunrise',
  '{}',
  NOW(),
  NOW()
);

-- 3. Create status lists (wip_limit removed by migration 20251229213244)
INSERT INTO statuslist (id, board_id, name, color, "order", created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'Backlog', '#8B7355', 0, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'Todo', '#6B8E23', 1, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'In Progress', '#CD853F', 2, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'Review', '#4682B4', 3, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000205'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'Done', '#556B2F', 4, NOW(), NOW());

-- 4. Create test repo card (note column removed by migration 20251230100003)
INSERT INTO repocard (id, board_id, status_id, repo_owner, repo_name, "order", meta, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000301'::uuid,
  '00000000-0000-0000-0000-000000000100'::uuid, -- Test board ID
  '00000000-0000-0000-0000-000000000203'::uuid, -- In Progress status
  'ryotamurakami',
  'gitbox',
  0,
  '{"priority": "high", "tags": ["Next.js", "TypeScript"]}'::jsonb,
  NOW(),
  NOW()
);
