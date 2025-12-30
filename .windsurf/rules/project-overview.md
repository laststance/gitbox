---
trigger: always_on
description: 'GitBox - GitHub リポジトリを Kanban 形式で管理するアプリケーション。Supabase + Next.js App Router + Redux Toolkit で構築。12テーマ対応、i18n（日英）、Maintenance Mode などを実装。'
globs:
---

# GitBox プロジェクト概要

## 🎯 プロダクト概要

**GitBox** は GitHub リポジトリを Kanban 形式で視覚的に管理できるアプリケーションです。

**🔴 CRITICAL: 必ず test/lint/build/typecheckを並列実行し、パスしてからセッションを終えること**

### ナビゲーションフロー

```
Auth (GitHub OAuth) → Home (Boards) → Board (Kanban) → Card Detail (right panel)
```

### 主要画面

| 画面             | パス           | 説明                           |
| ---------------- | -------------- | ------------------------------ |
| Landing          | `/`            | ログイン/サインインボタン配置  |
| Boards           | `/boards`      | ボード一覧、作成               |
| Board (Kanban)   | `/board/[id]`  | カンバンボード、D&D操作        |
| Maintenance Mode | `/maintenance` | 完了・保守中プロジェクト保管庫 |
| Settings         | `/settings`    | テーマ/言語設定                |
| Command Palette  | `⌘K`           | グローバル検索・ナビゲーション |

---

## 🛠️ 技術スタック

### フロントエンド

- **Next.js 16** (App Router, Server Components, Server Actions)
- **React 19**
- **TypeScript 5**
- **Redux Toolkit** (状態管理)
- **Tailwind CSS** + **shadcn/ui** (UI コンポーネント)
- **@dnd-kit** (ドラッグ&ドロップ)

### バックエンド

- **Supabase** (PostgreSQL, Auth, Storage)
- **Server Actions** (データ操作)

### その他

- **i18n** (日本語/英語)
- **12 テーマ** (Light 6 + Dark 6)

---

## 🗂️ ディレクトリ構成

```
gitbox/
├── app/                    # Next.js App Router
│   ├── auth/callback/      # GitHub OAuth コールバック
│   ├── board/[id]/         # カンバンボード
│   ├── boards/             # ボード一覧
│   ├── maintenance/        # メンテナンスモード
│   ├── settings/           # 設定画面
│   └── login/              # ログイン画面
├── components/
│   ├── Board/              # KanbanBoard, RepoCard, StatusColumn
│   ├── CommandPalette/     # コマンドパレット
│   ├── Modals/             # ProjectInfoModal, StatusListDialog
│   ├── Sidebar/            # サイドバー
│   └── ui/                 # shadcn/ui コンポーネント
├── lib/
│   ├── actions/            # ⭐ Server Actions (詳細は下記参照)
│   ├── hooks/              # カスタムフック
│   ├── i18n/               # 多言語対応
│   ├── models/             # ドメインモデル
│   ├── redux/              # Redux store, slices
│   └── supabase/           # Supabase クライアント
├── styles/
│   ├── globals.css
│   └── themes/             # 12テーマの CSS
├── supabase/
│   ├── migrations/         # DB マイグレーション
│   └── config.toml
└── tests/                  # Playwright E2E, Vitest ユニット
```

### lib/actions/ - Server Actions

`lib/actions/` ディレクトリには **Next.js Server Actions** のコードが格納されています。
すべてのファイルは `'use server'` ディレクティブで始まり、サーバーサイドでのみ実行されます。

| ファイル          | 説明                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| `github.ts`       | **GitHub REST API 通信**（認証ユーザー情報、リポジトリ取得、組織一覧など） |
| `board.ts`        | Board CRUD 操作                                                            |
| `repo-cards.ts`   | RepoCard CRUD 操作、ボードへのリポジトリ追加                               |
| `project-info.ts` | ProjectInfo（Quick Note, Links, Credentials）操作                          |
| `auth.ts`         | 認証関連操作                                                               |
| `audit-log.ts`    | 監査ログ記録                                                               |

#### GitHub API 通信について

GitHub API への通信は **すべて `lib/actions/github.ts`** で行います。

**理由**: GitHub OAuth トークン (`github_provider_token`) は HTTP-only Cookie に保存されており、
クライアントサイド JavaScript からはアクセスできません。そのため、Server Actions を使用して
サーバーサイドでトークンを取得し、GitHub API を呼び出す設計になっています。

```typescript
// lib/actions/github.ts の主要関数
export async function getAuthenticatedUser() // ログインユーザー情報
export async function getAuthenticatedUserOrganizations() // 所属組織一覧
export async function getAuthenticatedUserRepositories() // リポジトリ一覧
export async function searchRepositories() // リポジトリ検索
export async function getRepository() // 特定リポジトリ取得
export async function checkGitHubTokenValidity() // トークン有効性確認
```

---

## 📊 データモデル

### Supabase テーブル（小文字で命名）

```sql
-- board テーブル
board {
  id: uuid,
  name: string,
  user_id: uuid,
  theme: string,
  settings: jsonb  -- { compact }
}

-- statuslist テーブル
statuslist {
  id: uuid,
  board_id: uuid,
  name: string,
  color: string,
  "order": int
}

-- repocard テーブル
repocard {
  id: uuid,
  status_id: uuid,
  repo_owner: string,
  repo_name: string,
  "order": int,
  meta: jsonb  -- { stars, updated_at, visibility, language, topics[] }
}

-- projectinfo テーブル
projectinfo {
  id: uuid,
  repo_card_id: uuid,
  note: text,         -- Rich text notes (max 20,000 chars), edited via NoteModal
  comment: text,      -- Inline comment (max 2,000 chars), displayed on RepoCard
  links: jsonb,       -- { production[], tracking[], supabase[] }
  credentials: jsonb  -- [{ type, name, reference/encrypted_value/location }]
}

-- auditlog テーブル（セキュリティ）
auditlog {
  id: uuid,
  user_id: uuid,
  action: string,
  resource_id: string,
  resource_type: string,
  timestamp: timestamp,
  ip_address: string,
  user_agent: string,
  success: boolean
}
```

---

## 🔐 Supabase + GitHub OAuth 設定

### 重要な設定箇所（3つを揃える必要あり）

1. **GitHub OAuth App** (`github.com/settings/developers`)
   - Authorization callback URL: `https://<PROJECT>.supabase.co/auth/v1/callback`

2. **Supabase Auth Provider** (Dashboard > Authentication > Providers)
   - GitHub を有効化
   - Client ID / Client Secret を設定

3. **Supabase Auth URL Configuration** (Dashboard > Authentication > URL Configuration)
   - Site URL: `http://localhost:3008` (ローカル) or `https://your-domain.com` (本番)
   - Redirect URLs:
     - `http://localhost:3008/auth/callback`
     - `https://*.vercel.app/**`
     - `https://your-domain.com/auth/callback`

### 環境変数（.env.local）

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx...  # ⚠️ サーバー側のみ

# 暗号化（Credentials 機能）
ENCRYPTION_KEY=<32文字のランダム文字列>
ENCRYPTION_IV=<16文字のランダム文字列>
```

### provider_token の取り扱い

GitHub API を呼び出すには `provider_token` が必要です。

```typescript
// app/auth/callback/route.ts で Cookie に保存
const { data } = await supabase.auth.exchangeCodeForSession(code)
if (data.session?.provider_token) {
  response.cookies.set('github_provider_token', data.session.provider_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7日
  })
}

// lib/actions/github.ts で Cookie から取得
const token = cookies().get('github_provider_token')?.value
```

---

## ⌨️ ショートカット

| キー    | 操作                                                          |
| ------- | ------------------------------------------------------------- |
| `.`     | フォーカス中カードの Overflow menu                            |
| `Enter` | 既定アクション（Board=Open card、Maintenance=Open on GitHub） |
| `⌘K`    | Command Palette                                               |
| `Z`     | Undo last move                                                |
| `?`     | Shortcuts help                                                |

---

## 🎨 テーマ（12種類）

### Light テーマ

- Sunrise, Sandstone, Mint, Sky, Lavender, Rose

### Dark テーマ

- Midnight, Graphite, Forest, Ocean, Plum, Rust

### アクセシビリティ要件

- 本文テキスト: **4.5:1** 以上（WCAG AA）
- UI コンポーネント: **3:1** 以上

---

## 🚀 開発コマンド

```bash
# 開発サーバー起動
pnpm dev

# Supabase ローカル起動
supabase start

# マイグレーション適用
supabase db push

# ビルド
pnpm build

# テスト
pnpm test
pnpm e2e
```

---

## ⚠️ 注意事項

### テーブル名の規約

PostgreSQL はデフォルトで識別子を小文字に変換するため、Server Actions では **小文字のテーブル名** を使用：

```typescript
// ✅ 正しい
const { data } = await supabase.from('board').select('*')
const { data } = await supabase.from('repocard').select('*')

// ❌ 間違い（エラーになる可能性）
const { data } = await supabase.from('Board').select('*')
const { data } = await supabase.from('RepoCard').select('*')
```

### 環境変数のセキュリティ

- `.env.local` は `.gitignore` に含める
- `*.backup` ファイルもコミットしない
- Supabase キーが漏洩した場合は Dashboard で即座にローテーション

---

## 📚 参考リンク

- [PRD.md](./PRD.md) - プロダクト要件定義書
- [VERCEL-SUPABASE-SETUP.md](./VERCEL-SUPABASE-SETUP.md) - Supabase セットアップガイド
- [Supabase Docs](https://supabase.com/docs/)
- [Next.js App Router Docs](https://nextjs.org/docs/app)
