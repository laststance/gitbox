-- Vibe Rush - Initial Database Schema Migration
-- Created: 2025-11-15
-- Purpose: Create all tables, indexes, RLS policies, functions, and triggers

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Tables
-- ============================================================================

-- 1. Board (Kanban ボード)
CREATE TABLE Board (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) > 0),
  theme text DEFAULT 'sunrise',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. StatusList (ステータス列)
CREATE TABLE StatusList (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES Board(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) > 0),
  color text DEFAULT '#6B7280',
  wip_limit integer CHECK (wip_limit IS NULL OR wip_limit > 0),
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. RepoCard (Repository カード)
CREATE TABLE RepoCard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES Board(id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES StatusList(id) ON DELETE CASCADE,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  note text CHECK (length(note) <= 300),
  "order" integer NOT NULL DEFAULT 0,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_repo_per_board UNIQUE (board_id, repo_owner, repo_name)
);

-- 4. ProjectInfo (Project 詳細情報)
CREATE TABLE ProjectInfo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_card_id uuid NOT NULL UNIQUE REFERENCES RepoCard(id) ON DELETE CASCADE,
  links jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Credential (機密情報)
CREATE TABLE Credential (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_info_id uuid NOT NULL REFERENCES ProjectInfo(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('reference', 'encrypted', 'external')),
  name text NOT NULL CHECK (length(name) > 0),
  reference text CHECK ((type = 'reference' AND reference IS NOT NULL) OR type != 'reference'),
  encrypted_value text CHECK ((type = 'encrypted' AND encrypted_value IS NOT NULL) OR type != 'encrypted'),
  encryption_key_id text,
  masked_display text,
  location text CHECK ((type = 'external' AND location IS NOT NULL) OR type != 'external'),
  note text,
  created_at timestamptz DEFAULT now(),
  last_accessed timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- 6. Maintenance (保守モード)
CREATE TABLE Maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_card_id uuid UNIQUE REFERENCES RepoCard(id) ON DELETE CASCADE,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  note text,
  hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_repo_per_user UNIQUE (user_id, repo_owner, repo_name)
);

-- 7. AuditLog (監査ログ)
CREATE TABLE AuditLog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('reveal', 'copy', 'update', 'delete')),
  resource_id uuid NOT NULL,
  resource_type text NOT NULL DEFAULT 'credential',
  ip_address inet,
  user_agent text,
  success boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Board indexes
CREATE INDEX idx_board_user_id ON Board(user_id);

-- StatusList indexes
CREATE INDEX idx_statuslist_board_id ON StatusList(board_id);
CREATE INDEX idx_statuslist_order ON StatusList(board_id, "order");

-- RepoCard indexes
CREATE INDEX idx_repocard_board_id ON RepoCard(board_id);
CREATE INDEX idx_repocard_status_id ON RepoCard(status_id);
CREATE INDEX idx_repocard_order ON RepoCard(status_id, "order");

-- ProjectInfo indexes
CREATE INDEX idx_projectinfo_repo_card_id ON ProjectInfo(repo_card_id);

-- Credential indexes
CREATE INDEX idx_credential_project_info_id ON Credential(project_info_id);
CREATE INDEX idx_credential_type ON Credential(type);

-- Maintenance indexes
CREATE INDEX idx_maintenance_user_id ON Maintenance(user_id);
CREATE INDEX idx_maintenance_hidden ON Maintenance(user_id, hidden);

-- AuditLog indexes
CREATE INDEX idx_auditlog_user_id ON AuditLog(user_id);
CREATE INDEX idx_auditlog_resource_id ON AuditLog(resource_id);
CREATE INDEX idx_auditlog_created_at ON AuditLog(created_at DESC);

-- ============================================================================
-- Constraints
-- ============================================================================

-- Board theme constraint
ALTER TABLE Board ADD CONSTRAINT check_theme
  CHECK (theme IN (
    'sunrise', 'sandstone', 'mint', 'sky', 'lavender', 'rose',
    'midnight', 'graphite', 'forest', 'ocean', 'plum', 'rust'
  ));

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================

ALTER TABLE Board ENABLE ROW LEVEL SECURITY;
ALTER TABLE StatusList ENABLE ROW LEVEL SECURITY;
ALTER TABLE RepoCard ENABLE ROW LEVEL SECURITY;
ALTER TABLE ProjectInfo ENABLE ROW LEVEL SECURITY;
ALTER TABLE Credential ENABLE ROW LEVEL SECURITY;
ALTER TABLE Maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE AuditLog ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies: Board
-- ============================================================================

CREATE POLICY "Users can view their own boards"
  ON Board FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own boards"
  ON Board FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own boards"
  ON Board FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own boards"
  ON Board FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS Policies: StatusList
-- ============================================================================

CREATE POLICY "Users can view their board's status lists"
  ON StatusList FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM Board WHERE Board.id = StatusList.board_id AND Board.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their board's status lists"
  ON StatusList FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM Board WHERE Board.id = StatusList.board_id AND Board.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS Policies: RepoCard
-- ============================================================================

CREATE POLICY "Users can view their board's repo cards"
  ON RepoCard FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM Board WHERE Board.id = RepoCard.board_id AND Board.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their board's repo cards"
  ON RepoCard FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM Board WHERE Board.id = RepoCard.board_id AND Board.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS Policies: ProjectInfo
-- ============================================================================

CREATE POLICY "Users can view their project info"
  ON ProjectInfo FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM RepoCard
      JOIN Board ON Board.id = RepoCard.board_id
      WHERE RepoCard.id = ProjectInfo.repo_card_id AND Board.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their project info"
  ON ProjectInfo FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM RepoCard
      JOIN Board ON Board.id = RepoCard.board_id
      WHERE RepoCard.id = ProjectInfo.repo_card_id AND Board.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS Policies: Credential
-- ============================================================================

CREATE POLICY "Users can view their credentials"
  ON Credential FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ProjectInfo
      JOIN RepoCard ON RepoCard.id = ProjectInfo.repo_card_id
      JOIN Board ON Board.id = RepoCard.board_id
      WHERE ProjectInfo.id = Credential.project_info_id AND Board.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their credentials"
  ON Credential FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ProjectInfo
      JOIN RepoCard ON RepoCard.id = ProjectInfo.repo_card_id
      JOIN Board ON Board.id = RepoCard.board_id
      WHERE ProjectInfo.id = Credential.project_info_id AND Board.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS Policies: Maintenance
-- ============================================================================

CREATE POLICY "Users can view their maintenance items"
  ON Maintenance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their maintenance items"
  ON Maintenance FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS Policies: AuditLog
-- ============================================================================

CREATE POLICY "Users can view their audit logs"
  ON AuditLog FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only service role can create audit logs"
  ON AuditLog FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Audit logs are immutable"
  ON AuditLog FOR UPDATE
  USING (false);

CREATE POLICY "Audit logs cannot be deleted"
  ON AuditLog FOR DELETE
  USING (false);

-- ============================================================================
-- Functions & Triggers
-- ============================================================================

-- 1. updated_at 自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガー設定
CREATE TRIGGER update_board_updated_at
  BEFORE UPDATE ON Board
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_statuslist_updated_at
  BEFORE UPDATE ON StatusList
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repocard_updated_at
  BEFORE UPDATE ON RepoCard
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projectinfo_updated_at
  BEFORE UPDATE ON ProjectInfo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credential_updated_at
  BEFORE UPDATE ON Credential
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_updated_at
  BEFORE UPDATE ON Maintenance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. デフォルトボード作成トリガー
CREATE OR REPLACE FUNCTION create_default_board()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO Board (user_id, name, theme)
  VALUES (NEW.id, 'My First Board', 'sunrise');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_board();
