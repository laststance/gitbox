# Quick Start: Vibe Rush セットアップガイド

**作成日**: 2025-11-15
**対象**: 開発者（ローカル開発環境セットアップ）
**前提条件**: Node.js 18+, pnpm 8+, Docker Desktop

---

## 目次

1. [リポジトリのクローン](#1-リポジトリのクローン)
2. [依存関係のインストール](#2-依存関係のインストール)
3. [ローカル Supabase のセットアップ](#3-ローカル-supabase-のセットアップ)
4. [環境変数の設定](#4-環境変数の設定)
5. [GitHub OAuth App の作成（Dev用）](#5-github-oauth-app-の作成dev用)
6. [型生成とコード生成](#6-型生成とコード生成)
7. [開発サーバーの起動](#7-開発サーバーの起動)
8. [Storybook の起動](#8-storybook-の起動)
9. [テストの実行](#9-テストの実行)
10. [Production 環境へのデプロイ](#10-production-環境へのデプロイ)

---

## 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/vibe-rush.git
cd vibe-rush
```

---

## 2. 依存関係のインストール

```bash
# pnpm をグローバルインストール（未インストールの場合）
npm install -g pnpm

# プロジェクトの依存関係をインストール
pnpm install

# Prettier, Husky, lint-staged のセットアップ
pnpm dlx prettier-husky-lint-staged-installer
```

**インストールされる主要パッケージ**:
- Next.js 16, React 19, TypeScript 5.x
- Redux Toolkit, RTK Query
- Supabase Client, @supabase/ssr
- react-hook-form, zod, ts-pattern, date-fns
- Vitest, Playwright, Storybook v10
- ESLint v9, eslint-config-ts-prefixer, @laststance/react-next-eslint-plugin
- Sentry

---

## 3. ローカル Supabase のセットアップ

### 3.1. Docker Desktop の起動

Supabase は Docker Compose で起動するため、Docker Desktop を事前に起動してください。

### 3.2. Supabase CLI のインストール

```bash
# Homebrew (macOS)
brew install supabase/tap/supabase

# npm (Windows/Linux)
npm install -g supabase
```

### 3.3. ローカル Supabase の初期化と起動

```bash
# Supabase プロジェクトの初期化（初回のみ）
npx supabase init

# ローカル Supabase を起動（PostgreSQL + Auth + Storage）
npx supabase start
```

**出力例**:
```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3.4. データベースマイグレーションの実行

```bash
# マイグレーションファイルを作成（初回のみ）
npx supabase migration new initial_schema

# マイグレーションを実行
npx supabase db reset
```

**Note**: マイグレーション SQL は `data-model.md` を参照して `supabase/migrations/` に配置してください。

---

## 4. 環境変数の設定

### 4.1. `.env.local` ファイルの作成

```bash
cp .env.example .env.local
```

### 4.2. `.env.local` の内容

```bash
# Supabase (ローカル開発用)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # ローカル anon key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # ローカル service_role key

# GitHub OAuth (Dev用 - 次のステップで取得)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Next.js
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Sentry (Optional - Production のみ)
# NEXT_PUBLIC_SENTRY_DSN=
# SENTRY_AUTH_TOKEN=
```

**重要**: `.env.local` は `.gitignore` に含まれているため、コミットされません。

---

## 5. GitHub OAuth App の作成（Dev用）

### 5.1. GitHub OAuth App の新規作成

1. GitHub にログイン
2. `Settings` → `Developer settings` → `OAuth Apps` → `New OAuth App`
3. 以下の情報を入力:
   - **Application name**: `Vibe Rush (Dev)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:54321/auth/v1/callback` (Supabase ローカル Auth)
4. `Register application` をクリック
5. **Client ID** と **Client Secret** をコピー

### 5.2. Supabase に GitHub OAuth を設定

```bash
# Supabase のローカル設定ファイルを編集
# supabase/config.toml

[auth.external.github]
enabled = true
client_id = "env(GITHUB_CLIENT_ID)"
secret = "env(GITHUB_CLIENT_SECRET)"
redirect_uri = "http://localhost:54321/auth/v1/callback"
```

### 5.3. 環境変数に追加

`.env.local` に GitHub OAuth の認証情報を追加:
```bash
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

### 5.4. Supabase を再起動

```bash
npx supabase stop
npx supabase start
```

---

## 6. 型生成とコード生成

### 6.1. Supabase TypeScript 型の生成

```bash
# ローカル Supabase から型を生成
pnpm codegen:supabase:local
```

**出力**: `lib/supabase/types.ts`

### 6.2. GitHub REST API クライアントの生成

```bash
# GitHub OpenAPI スキーマから RTK Query クライアントを生成
pnpm codegen:github
```

**出力**: `lib/github/api.ts`

### 6.3. 一括生成（推奨）

```bash
# 全ての型とコードを一括生成
pnpm codegen:all
```

---

## 7. 開発サーバーの起動

```bash
# Next.js 開発サーバーを起動
pnpm dev
```

**アクセス**: [http://localhost:3000](http://localhost:3000)

**動作確認**:
1. Landing Page が表示される
2. "Sign in with GitHub" ボタンをクリック
3. GitHub OAuth フローが開始される
4. 認証成功後、Boards 画面にリダイレクトされる

---

## 8. Storybook の起動

```bash
# Storybook を起動
pnpm storybook
```

**アクセス**: [http://localhost:6006](http://localhost:6006)

**利用方法**:
- 既存コンポーネントのカタログを確認
- Magic MCP で生成したコンポーネントの Story を追加
- 12 テーマでの表示確認

---

## 9. テストの実行

### 9.1. Unit Tests (Vitest)

```bash
# 全ての単体テストを実行
pnpm test

# Watch モード（ファイル変更時に自動実行）
pnpm test:watch

# カバレッジレポート生成
pnpm test:coverage
```

### 9.2. E2E Tests (Playwright)

```bash
# Playwright のブラウザをインストール（初回のみ）
pnpm exec playwright install

# E2E テストを実行（Headless モード）
pnpm test:e2e

# UI モード（デバッグ用）
pnpm test:e2e:ui

# 特定のテストのみ実行
pnpm test:e2e tests/e2e/auth.spec.ts
```

**Note**: E2E テストは開発サーバーが起動している必要があります（`pnpm dev` を別ターミナルで実行）。

### 9.3. Accessibility Tests (WCAG AA)

```bash
# 12 テーマのコントラスト検証
pnpm test:e2e:accessibility

# ビルド時の自動検証
pnpm build # コントラスト違反があれば失敗
```

---

## 10. Production 環境へのデプロイ

### 10.1. Vercel へのデプロイ

#### Vercel CLI のインストール

```bash
npm install -g vercel
```

#### Vercel プロジェクトの作成

```bash
vercel login
vercel
```

**対話式プロンプト**:
```
? Set up and deploy "~/vibe-rush"? [Y/n] Y
? Which scope do you want to deploy to? <your-account>
? Link to existing project? [y/N] N
? What's your project's name? vibe-rush
? In which directory is your code located? ./
```

#### 環境変数の設定（Vercel Dashboard）

1. Vercel Dashboard にアクセス: https://vercel.com/dashboard
2. プロジェクト → `Settings` → `Environment Variables`
3. 以下の環境変数を追加:

**Production Environment**:
```
NEXT_PUBLIC_SUPABASE_URL=https://<your-prod-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-prod-anon-key>
NEXT_PUBLIC_SITE_URL=https://vibe-rush.vercel.app
GITHUB_CLIENT_ID=<prod-github-client-id>
GITHUB_CLIENT_SECRET=<prod-github-client-secret>
NEXT_PUBLIC_SENTRY_DSN=<your-sentry-dsn>
SENTRY_AUTH_TOKEN=<your-sentry-token>
```

**Preview Environment** (Optional):
```
NEXT_PUBLIC_SUPABASE_URL=https://<your-dev-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-dev-anon-key>
NEXT_PUBLIC_SITE_URL=https://vibe-rush-git-<branch>.vercel.app
GITHUB_CLIENT_ID=<dev-github-client-id>
GITHUB_CLIENT_SECRET=<dev-github-client-secret>
```

### 10.2. Supabase Production プロジェクトのセットアップ

#### Supabase プロジェクトの作成

1. Supabase Dashboard にアクセス: https://supabase.com/dashboard
2. `New Project` をクリック
3. プロジェクト名: `vibe-rush-prod`
4. データベースパスワードを設定（強力なパスワード推奨）
5. リージョン: `Northeast Asia (Tokyo)` (日本向けの場合)
6. `Create new project` をクリック

#### GitHub OAuth の設定

1. Supabase Dashboard → `Authentication` → `Providers` → `GitHub`
2. `Enabled` を ON
3. GitHub OAuth App の **Client ID** と **Client Secret** を入力
   - **Callback URL**: `https://<your-prod-project>.supabase.co/auth/v1/callback`
4. `Save` をクリック

#### Redirect URLs の設定

1. Supabase Dashboard → `Authentication` → `URL Configuration`
2. `Redirect URLs` に以下を追加:
   - `https://vibe-rush.vercel.app/auth/callback`
   - `https://vibe-rush-git-*.vercel.app/auth/callback` (Preview 用)
3. `Save` をクリック

#### マイグレーションの実行

```bash
# Production Supabase にマイグレーションを適用
npx supabase link --project-ref <your-prod-project-ref>
npx supabase db push
```

### 10.3. GitHub OAuth App の作成（Production用）

1. GitHub → `Settings` → `Developer settings` → `OAuth Apps` → `New OAuth App`
2. 入力:
   - **Application name**: `Vibe Rush`
   - **Homepage URL**: `https://vibe-rush.vercel.app`
   - **Authorization callback URL**: `https://<your-prod-project>.supabase.co/auth/v1/callback`
3. **Client ID** と **Client Secret** を Vercel の環境変数に設定

### 10.4. デプロイ

```bash
# Production にデプロイ
vercel --prod
```

**デプロイ後の動作確認**:
1. `https://vibe-rush.vercel.app` にアクセス
2. GitHub ログイン → Boards 画面に遷移
3. Repository 追加、ドラッグ&ドロップ、テーマ切り替えが動作することを確認

---

## トラブルシューティング

### Supabase が起動しない

**原因**: Docker Desktop が起動していない、ポートが使用中

**解決策**:
```bash
# Docker Desktop を起動
open -a Docker

# ポート使用状況を確認
lsof -i :54321
lsof -i :54322

# プロセスを停止してから再起動
npx supabase stop
npx supabase start
```

### GitHub OAuth ログインが失敗する

**原因**: Callback URL の設定ミス、環境変数の不一致

**解決策**:
1. GitHub OAuth App の Callback URL が Supabase の `/auth/v1/callback` になっているか確認
2. `.env.local` の `GITHUB_CLIENT_ID` と `GITHUB_CLIENT_SECRET` が正しいか確認
3. Supabase を再起動: `npx supabase stop && npx supabase start`

### E2E テストが失敗する

**原因**: 開発サーバーが起動していない、Playwright ブラウザ未インストール

**解決策**:
```bash
# 開発サーバーを起動
pnpm dev

# Playwright ブラウザをインストール
pnpm exec playwright install

# テストを再実行
pnpm test:e2e
```

### ビルドが失敗する（コントラスト検証エラー）

**原因**: テーマのコントラスト比が WCAG AA 基準を満たしていない

**解決策**:
1. `styles/themes/` のテーマ CSS を確認
2. コントラスト比を修正（Text: 4.5:1, UI: 3:1 以上）
3. Playwright でコントラスト検証を実行: `pnpm test:e2e:accessibility`

---

## 参考資料

### セットアップガイド
- [VERCEL-SUPABASE-SETUP.md](../../VERCEL-SUPABASE-SETUP.md) (プロジェクト内の詳細ガイド)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [Vercel Deployment Guide](https://vercel.com/docs/deployments/overview)

### 技術ドキュメント
- [Next.js 16 App Router](https://nextjs.org/docs/app)
- [Supabase TypeScript Support](https://supabase.com/docs/guides/api/generating-types)
- [RTK Query Code Generation](https://redux-toolkit.js.org/rtk-query/usage/code-generation)
- [Playwright Testing](https://playwright.dev/)
- [Vitest Documentation](https://vitest.dev/)

### PRD & 仕様
- [PRD.md](../../PRD.md) - プロダクト要件定義
- [spec.md](./spec.md) - 機能仕様
- [data-model.md](./data-model.md) - データモデル設計
