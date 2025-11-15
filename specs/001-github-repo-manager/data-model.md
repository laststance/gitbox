# Data Model: Vibe Rush - データベーススキーマ設計

**作成日**: 2025-11-15
**ステータス**: Completed
**目的**: Supabase PostgreSQL のテーブル設計、リレーション、制約、Row Level Security (RLS) ポリシー定義

---

## エンティティ関係図 (ER Diagram)

```
User (Supabase Auth)
  ├──< Board (1:N)
  │     ├──< StatusList (1:N)
  │     └──< RepoCard (1:N)
  │           └── ProjectInfo (1:1)
  │                 └──< Credential (1:N)
  ├──< Maintenance (1:N)
  └──< AuditLog (1:N)
```

---

## 1. User (Supabase Auth テーブル)

**管理**: Supabase Auth が自動管理（`auth.users` テーブル）

| Column | Type | 説明 |
|--------|------|------|
| `id` | `uuid` (PK) | Supabase Auth が自動生成 |
| `email` | `text` | GitHub OAuth で取得 |
| `created_at` | `timestamptz` | アカウント作成日時 |
| `updated_at` | `timestamptz` | 最終更新日時 |

**Notes**:
- GitHub OAuth のユーザー情報は `auth.users.raw_user_meta_data` (JSONB) に保存
- `raw_user_meta_data.avatar_url`: GitHub アバター URL
- `raw_user_meta_data.user_name`: GitHub ユーザー名

**RLS ポリシー**:
- Supabase Auth が管理（アプリケーションで RLS 設定不要）

---

## 2. Board (Kanban ボード)

**目的**: Repository カードを整理する Kanban ボード

| Column | Type | Constraints | 説明 |
|--------|------|------------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | ボード ID |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL | 所有者 |
| `name` | `text` | NOT NULL, CHECK (length(name) > 0) | ボード名 |
| `theme` | `text` | DEFAULT 'sunrise' | テーマ名（12種類から選択） |
| `settings` | `jsonb` | DEFAULT '{}' | 設定（WIP limits, compact mode など） |
| `created_at` | `timestamptz` | DEFAULT now() | 作成日時 |
| `updated_at` | `timestamptz` | DEFAULT now() | 最終更新日時 |

**Indexes**:
```sql
CREATE INDEX idx_board_user_id ON Board(user_id);
```

**RLS ポリシー**:
```sql
-- ユーザーは自分のボードのみ参照可能
CREATE POLICY "Users can view their own boards"
  ON Board FOR SELECT
  USING (auth.uid() = user_id);

-- ユーザーは自分のボードのみ作成可能
CREATE POLICY "Users can create their own boards"
  ON Board FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分のボードのみ更新可能
CREATE POLICY "Users can update their own boards"
  ON Board FOR UPDATE
  USING (auth.uid() = user_id);

-- ユーザーは自分のボードのみ削除可能
CREATE POLICY "Users can delete their own boards"
  ON Board FOR DELETE
  USING (auth.uid() = user_id);
```

**Validation**:
- `theme`: ENUM 型の代わりに CHECK 制約を使用（将来的なテーマ追加に対応）
```sql
ALTER TABLE Board ADD CONSTRAINT check_theme
  CHECK (theme IN (
    'sunrise', 'sandstone', 'mint', 'sky', 'lavender', 'rose',
    'midnight', 'graphite', 'forest', 'ocean', 'plum', 'rust'
  ));
```

---

## 3. StatusList (ステータス列)

**目的**: Board 内の列（例: Suspend, Spec designing, Active, Completed）

| Column | Type | Constraints | 説明 |
|--------|------|------------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 列 ID |
| `board_id` | `uuid` | FK → Board(id) ON DELETE CASCADE, NOT NULL | 所属ボード |
| `name` | `text` | NOT NULL, CHECK (length(name) > 0) | 列名 |
| `color` | `text` | DEFAULT '#6B7280' | 列の色（HEX） |
| `wip_limit` | `integer` | CHECK (wip_limit IS NULL OR wip_limit > 0) | WIP 制限（NULL = 無制限） |
| `order` | `integer` | NOT NULL, DEFAULT 0 | 表示順序（小さいほど左） |
| `created_at` | `timestamptz` | DEFAULT now() | 作成日時 |
| `updated_at` | `timestamptz` | DEFAULT now() | 最終更新日時 |

**Indexes**:
```sql
CREATE INDEX idx_statuslist_board_id ON StatusList(board_id);
CREATE INDEX idx_statuslist_order ON StatusList(board_id, "order");
```

**RLS ポリシー**:
```sql
-- ユーザーは自分のボードの列のみ参照可能
CREATE POLICY "Users can view their board's status lists"
  ON StatusList FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM Board WHERE Board.id = StatusList.board_id AND Board.user_id = auth.uid()
    )
  );

-- ユーザーは自分のボードの列のみ作成・更新・削除可能
CREATE POLICY "Users can manage their board's status lists"
  ON StatusList FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM Board WHERE Board.id = StatusList.board_id AND Board.user_id = auth.uid()
    )
  );
```

---

## 4. RepoCard (Repository カード)

**目的**: GitHub Repository を表すカード

| Column | Type | Constraints | 説明 |
|--------|------|------------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | カード ID |
| `board_id` | `uuid` | FK → Board(id) ON DELETE CASCADE, NOT NULL | 所属ボード |
| `status_id` | `uuid` | FK → StatusList(id) ON DELETE CASCADE, NOT NULL | 現在のステータス |
| `repo_owner` | `text` | NOT NULL | Repository owner (例: "laststance") |
| `repo_name` | `text` | NOT NULL | Repository name (例: "vibe-rush") |
| `note` | `text` | CHECK (length(note) <= 300) | Quick note (1〜3行、最大300文字) |
| `order` | `integer` | NOT NULL, DEFAULT 0 | 列内の順序（小さいほど上） |
| `meta` | `jsonb` | DEFAULT '{}' | GitHub メタデータ（stars, updatedAt, visibility, language, topics） |
| `created_at` | `timestamptz` | DEFAULT now() | 作成日時 |
| `updated_at` | `timestamptz` | DEFAULT now() | 最終更新日時 |

**Unique Constraint**:
```sql
-- 同じボード内で同じ Repository は1つまで
ALTER TABLE RepoCard ADD CONSTRAINT unique_repo_per_board
  UNIQUE (board_id, repo_owner, repo_name);
```

**Indexes**:
```sql
CREATE INDEX idx_repocard_board_id ON RepoCard(board_id);
CREATE INDEX idx_repocard_status_id ON RepoCard(status_id);
CREATE INDEX idx_repocard_order ON RepoCard(status_id, "order");
```

**RLS ポリシー**:
```sql
-- ユーザーは自分のボードのカードのみ参照可能
CREATE POLICY "Users can view their board's repo cards"
  ON RepoCard FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM Board WHERE Board.id = RepoCard.board_id AND Board.user_id = auth.uid()
    )
  );

-- ユーザーは自分のボードのカードのみ作成・更新・削除可能
CREATE POLICY "Users can manage their board's repo cards"
  ON RepoCard FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM Board WHERE Board.id = RepoCard.board_id AND Board.user_id = auth.uid()
    )
  );
```

**meta JSONB Structure**:
```json
{
  "stars": 128,
  "updatedAt": "2025-11-15T10:30:00Z",
  "visibility": "public",
  "language": "TypeScript",
  "topics": ["react", "nextjs", "kanban"]
}
```

---

## 5. ProjectInfo (Project 詳細情報)

**目的**: Repository の詳細情報（Links, Credentials, Integrations）

| Column | Type | Constraints | 説明 |
|--------|------|------------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | Project Info ID |
| `repo_card_id` | `uuid` | FK → RepoCard(id) ON DELETE CASCADE, UNIQUE, NOT NULL | 対象カード |
| `links` | `jsonb` | DEFAULT '{}' | リンク集（production, tracking, supabase） |
| `created_at` | `timestamptz` | DEFAULT now() | 作成日時 |
| `updated_at` | `timestamptz` | DEFAULT now() | 最終更新日時 |

**Indexes**:
```sql
CREATE INDEX idx_projectinfo_repo_card_id ON ProjectInfo(repo_card_id);
```

**RLS ポリシー**:
```sql
-- ユーザーは自分のカードの Project Info のみ参照可能
CREATE POLICY "Users can view their project info"
  ON ProjectInfo FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM RepoCard
      JOIN Board ON Board.id = RepoCard.board_id
      WHERE RepoCard.id = ProjectInfo.repo_card_id AND Board.user_id = auth.uid()
    )
  );

-- ユーザーは自分のカードの Project Info のみ作成・更新・削除可能
CREATE POLICY "Users can manage their project info"
  ON ProjectInfo FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM RepoCard
      JOIN Board ON Board.id = RepoCard.board_id
      WHERE RepoCard.id = ProjectInfo.repo_card_id AND Board.user_id = auth.uid()
    )
  );
```

**links JSONB Structure**:
```json
{
  "production": [
    "https://app.example.com",
    "https://app-staging.example.com"
  ],
  "tracking": [
    "https://plausible.io/app.example.com",
    "https://analytics.google.com/..."
  ],
  "supabase": [
    "https://supabase.com/dashboard/project/abc123",
    "https://supabase.com/dashboard/project/abc123/editor"
  ]
}
```

---

## 6. Credential (機密情報)

**目的**: 3パターンの機密情報管理（Reference, Encrypted, External）

| Column | Type | Constraints | 説明 |
|--------|------|------------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | 認証情報 ID |
| `project_info_id` | `uuid` | FK → ProjectInfo(id) ON DELETE CASCADE, NOT NULL | 所属 Project Info |
| `type` | `text` | NOT NULL, CHECK (type IN ('reference', 'encrypted', 'external')) | 管理パターン |
| `name` | `text` | NOT NULL, CHECK (length(name) > 0) | 認証情報名（例: "Supabase API Key"） |
| `reference` | `text` | CHECK ((type = 'reference' AND reference IS NOT NULL) OR type != 'reference') | 参照 URL（type=reference の場合） |
| `encrypted_value` | `text` | CHECK ((type = 'encrypted' AND encrypted_value IS NOT NULL) OR type != 'encrypted') | 暗号化された値（type=encrypted の場合） |
| `encryption_key_id` | `text` | | KMS key reference（type=encrypted の場合） |
| `masked_display` | `text` | | マスク表示（例: "sk_live_****1234"） |
| `location` | `text` | CHECK ((type = 'external' AND location IS NOT NULL) OR type != 'external') | 外部管理場所（type=external の場合） |
| `note` | `text` | | 任意のメモ |
| `created_at` | `timestamptz` | DEFAULT now() | 作成日時 |
| `last_accessed` | `timestamptz` | | 最終アクセス日時（type=encrypted の場合） |
| `updated_at` | `timestamptz` | DEFAULT now() | 最終更新日時 |

**Indexes**:
```sql
CREATE INDEX idx_credential_project_info_id ON Credential(project_info_id);
CREATE INDEX idx_credential_type ON Credential(type);
```

**RLS ポリシー**:
```sql
-- ユーザーは自分の Project Info の Credential のみ参照可能
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

-- ユーザーは自分の Project Info の Credential のみ作成・更新・削除可能
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
```

**Encryption Strategy** (type = 'encrypted'):
1. **暗号化**: AES-256-GCM で `encrypted_value` を暗号化
2. **鍵管理**: AWS KMS / GCP KMS / Azure Key Vault で `encryption_key_id` を管理
3. **復号**: Supabase Edge Function で復号
4. **監査ログ**: 復号・コピー操作を `AuditLog` に記録

---

## 7. Maintenance (保守モード)

**目的**: 完了・保守中プロジェクトの管理

| Column | Type | Constraints | 説明 |
|--------|------|------------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | Maintenance ID |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL | 所有者 |
| `repo_card_id` | `uuid` | FK → RepoCard(id) ON DELETE CASCADE, UNIQUE | 対象カード（NULL = Board から移動前） |
| `repo_owner` | `text` | NOT NULL | Repository owner |
| `repo_name` | `text` | NOT NULL | Repository name |
| `note` | `text` | | Quick note（RepoCard から引き継ぎ） |
| `hidden` | `boolean` | DEFAULT false | 非表示フラグ |
| `created_at` | `timestamptz` | DEFAULT now() | 作成日時（Maintenance 移動日時） |
| `updated_at` | `timestamptz` | DEFAULT now() | 最終更新日時 |

**Unique Constraint**:
```sql
-- 同じユーザーで同じ Repository は1つまで
ALTER TABLE Maintenance ADD CONSTRAINT unique_repo_per_user
  UNIQUE (user_id, repo_owner, repo_name);
```

**Indexes**:
```sql
CREATE INDEX idx_maintenance_user_id ON Maintenance(user_id);
CREATE INDEX idx_maintenance_hidden ON Maintenance(user_id, hidden);
```

**RLS ポリシー**:
```sql
-- ユーザーは自分の Maintenance のみ参照可能
CREATE POLICY "Users can view their maintenance items"
  ON Maintenance FOR SELECT
  USING (auth.uid() = user_id);

-- ユーザーは自分の Maintenance のみ作成・更新・削除可能
CREATE POLICY "Users can manage their maintenance items"
  ON Maintenance FOR ALL
  USING (auth.uid() = user_id);
```

---

## 8. AuditLog (監査ログ)

**目的**: 機密情報アクセスの記録

| Column | Type | Constraints | 説明 |
|--------|------|------------|------|
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() | ログ ID |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL | 操作ユーザー |
| `action` | `text` | NOT NULL, CHECK (action IN ('reveal', 'copy', 'update', 'delete')) | アクション |
| `resource_id` | `uuid` | NOT NULL | リソース ID（Credential.id） |
| `resource_type` | `text` | NOT NULL, DEFAULT 'credential' | リソース種別 |
| `ip_address` | `inet` | | 操作元 IP アドレス |
| `user_agent` | `text` | | User-Agent |
| `success` | `boolean` | NOT NULL | 成功/失敗 |
| `created_at` | `timestamptz` | DEFAULT now() | 操作日時 |

**Indexes**:
```sql
CREATE INDEX idx_auditlog_user_id ON AuditLog(user_id);
CREATE INDEX idx_auditlog_resource_id ON AuditLog(resource_id);
CREATE INDEX idx_auditlog_created_at ON AuditLog(created_at DESC);
```

**RLS ポリシー**:
```sql
-- ユーザーは自分の監査ログのみ参照可能
CREATE POLICY "Users can view their audit logs"
  ON AuditLog FOR SELECT
  USING (auth.uid() = user_id);

-- 監査ログは Supabase Edge Function からのみ作成可能（ユーザーから直接作成不可）
CREATE POLICY "Only service role can create audit logs"
  ON AuditLog FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 監査ログは更新・削除不可（改ざん防止）
CREATE POLICY "Audit logs are immutable"
  ON AuditLog FOR UPDATE
  USING (false);

CREATE POLICY "Audit logs cannot be deleted"
  ON AuditLog FOR DELETE
  USING (false);
```

---

## Database Functions & Triggers

### 1. updated_at 自動更新トリガー

```sql
-- トリガー関数
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
```

### 2. デフォルトボード作成トリガー

```sql
-- 新規ユーザーに自動的にデフォルトボードを作成
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
```

---

## Migration Strategy

### Initial Migration

```sql
-- supabase/migrations/20251115_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER TABLE Board ENABLE ROW LEVEL SECURITY;
ALTER TABLE StatusList ENABLE ROW LEVEL SECURITY;
ALTER TABLE RepoCard ENABLE ROW LEVEL SECURITY;
ALTER TABLE ProjectInfo ENABLE ROW LEVEL SECURITY;
ALTER TABLE Credential ENABLE ROW LEVEL SECURITY;
ALTER TABLE Maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE AuditLog ENABLE ROW LEVEL SECURITY;

-- Create tables (順序: 外部キー依存関係に従う)
-- 1. Board
-- 2. StatusList
-- 3. RepoCard
-- 4. ProjectInfo
-- 5. Credential
-- 6. Maintenance
-- 7. AuditLog

-- Create indexes
-- Create RLS policies
-- Create functions & triggers
```

### TypeScript Type Generation

```bash
# Supabase TypeScript 型自動生成
npx supabase gen types typescript --project-id <project-id> > lib/supabase/types.ts
```

**生成される型の例**:
```typescript
export type Database = {
  public: {
    Tables: {
      Board: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          theme: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          theme?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          theme?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      // ...
    };
  };
};
```

---

## Performance Considerations

### Index Strategy
- **Primary Keys**: 全テーブルで `uuid` (B-tree index)
- **Foreign Keys**: 全外部キーに index 設定（JOIN 高速化）
- **Order Columns**: `(status_id, order)` 複合 index（ドラッグ&ドロップ高速化）
- **Created At**: `AuditLog.created_at DESC` index（監査ログ検索高速化）

### Query Optimization
- **N+1 問題回避**: Supabase Client の `select()` で JOIN を活用
  ```typescript
  const { data } = await supabase
    .from('RepoCard')
    .select(`
      *,
      status:StatusList(*),
      project_info:ProjectInfo(*, credentials:Credential(*))
    `)
    .eq('board_id', boardId);
  ```

- **JSONB クエリ最適化**: `meta` や `links` の検索には GIN index を検討
  ```sql
  CREATE INDEX idx_repocard_meta ON RepoCard USING GIN (meta);
  ```

---

## Security Considerations

### Row Level Security (RLS)
- **全テーブルで有効化**: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- **ユーザー分離**: `auth.uid()` で現在のユーザーを判定
- **Cascade Delete**: Board 削除時に StatusList, RepoCard, ProjectInfo, Credential も自動削除

### Credential Encryption
- **暗号化**: AES-256-GCM (Supabase Edge Function で実行)
- **鍵管理**: AWS KMS / GCP KMS / Azure Key Vault
- **監査ログ**: 全アクセスを記録（改ざん不可）

### SQL Injection 対策
- Supabase Client は **Prepared Statements** を自動使用
- JSONB への直接 SQL 挿入禁止（Supabase Client の `.insert()` `.update()` を使用）

---

## Next Steps

Phase 1 の次のステップ:
1. `contracts/github-rest-api.yaml`: GitHub REST API OpenAPI スキーマ配置
2. `quickstart.md`: セットアップガイド作成（Supabase migration 実行手順含む）
3. Agent context 更新
