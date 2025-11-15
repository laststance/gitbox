最初に全体の論点を整理してから、Supabase × GitHub ログイン × Next.js × Vercel の最新情報を一通り集め、その後公式ドキュメント中心に深掘りしてガイドを組み立てます。まずは思考整理 → 広く検索 → 公式＆実例の深掘り → Perplexity でダブルチェック → 最後に日本語 Markdown ガイドをまとめます。

[2 tools called]

ざっくり関連情報を広く集めました。次は公式ドキュメントやライブラリの詳細を context7 や Exa Code で深掘りしつつ、Prod/Local の DB 分離と GitHub OAuth 手順を具体化していきます。

[7 tools called]

## Executive Summary 🚀

- **Supabase プロジェクトは「本番」と「開発（ローカル用）」で分けるのが 2024–2025 年時点の推奨**：Supabase 1 プロジェクト = 1 DB/認証設定という単位なので、Vercel の production / preview / local それぞれに対応する別プロジェクトか、少なくとも「prod」と「dev」の 2 プロジェクトを用意する。  
  （Supabase blog “The Vibe Coder’s Guide to Supabase Environments”, GitHub 上 MDX, 2025-08-17[Supabase, `https://github.com/supabase/supabase/blob/master/apps/www/_blog/2025-08-17-the-vibe-coders-guide-to-supabase-environments.mdx`])

- **GitHub ログインは Supabase 側で GitHub プロバイダを有効化し、GitHub OAuth App の callback を Supabase の `/auth/v1/callback` に向ける**：そのうえで Next.js からは `signInWithOAuth({ provider: 'github', options: { redirectTo }})` を使ってアプリの URL に戻す。  
  （“Login with GitHub” guide, 2025-11-12[Supabase, `https://supabase.com/docs/guides/auth/social-login/auth-github`])

- **App Router（Next.js 14/15）では `@supabase/ssr` と Server Actions を使う構成が公式の推奨**：サーバー側で `signInWithOAuth` を呼び、`/auth/callback` ルートでセッションを取り出す構成にする。  
  （“Setting up Server-Side Auth for Next.js”, 2024-07-13[Supabase Docs, `https://docs-2ej5s7s9m-supabase.vercel.app/docs/guides/auth/server-side/nextjs`])

- **リダイレクト URL は「Supabase Auth の許可リスト」「GitHub OAuth App」「Next.js の `redirectTo`」の 3 箇所を揃える必要がある**：GitHub はワイルドカードをサポートしない一方で、Supabase は `additional_redirect_urls` で Vercel preview 用のワイルドカードをサポートする。  
  （“Redirect URLs” guide, 2024-08-02[Supabase Docs, `https://docs-hhahn5n6u-supabase.vercel.app/docs/guides/auth/redirect-urls`]; Supabase CLI v2 config-as-code blog, 2024-12-04[Supabase, `https://github.com/supabase/supabase/blob/master/apps/www/_blog/2024-12-04-cli-v2-config-as-code.mdx`])

- **環境変数は Next.js の `.env.local` と Vercel の Environment Variables で「prod」「preview」「local」を切り替える**：`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（または `ANON_KEY`）をそれぞれの Supabase プロジェクトに合わせて設定する。  
  （Next.js App Router Environment Variables guide, 2025-01-01[Vercel/Next.js, `https://nextjs.org/docs/app/guides/environment-variables`]; Supabase Next.js Quickstart, 2023–2024[Supabase, `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/getting-started/quickstarts/nextjs.mdx`])

- **ローカル DB を完全にローカルで持ちたい場合は Supabase CLI の `supabase start` を使い、`supabase/.env` と `.env.local` を連携させる**：GitHub OAuth 用の `SUPABASE_AUTH_GITHUB_CLIENT_ID/SECRET` を `.env` で管理し、`supabase/config.toml` から参照する。  
  （Local development overview, 2024 頃[Supabase Docs, `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/local-development/overview.mdx`]; “Local Development for SaaS product in 2024 // Next.js, Supabase and Stripe”, 2024-03-08[Supabase YouTube, `https://www.youtube.com/watch?v=Gbf-E3H824k`])

---

## What changed recently & why it matters (2024–2025 のポイント) ⚙️

- **Auth Guides の再構成と App Router 対応強化（2024）**  
  Supabase Auth ドキュメントは、App Router 用の server-side auth ガイドと社会ログイン（GitHub 等）のガイドが再構成され、`@supabase/ssr` と PKCE ベースの `signInWithOAuth` フローが正式なパターンとして整理された。これにより、旧来の client-only 実装や非 PKCE フローは非推奨扱いになっている。  
  （“Setting up Server-Side Auth for Next.js”, 2024-07-13[Supabase Docs, `https://docs-2ej5s7s9m-supabase.vercel.app/docs/guides/auth/server-side/nextjs`]; GitHub repo docs, 2023–2024[Supabase, `https://github.com/supabase/supabase`])

- **GitHub ログインガイドの更新（2024–2025）**  
  “Login with GitHub” ガイドが更新され、GitHub OAuth App の callback を Supabase の `/auth/v1/callback` に向けること、およびクライアント側の `redirectTo` でアプリ URL を制御する流れが明確化された。  
  （“Login with GitHub”, 2025-11-12[Supabase, `https://supabase.com/docs/guides/auth/social-login/auth-github`])

- **Redirect URLs ガイドの拡充（2024）**  
  `redirectTo` パラメータと、`NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_VERCEL_URL` を使って環境ごとに URL を組み立てる `getURL()` パターンがドキュメントに明記され、Vercel preview / prod / local を 1 つの実装で扱う方法が整理された。  
  （“Redirect URLs”, 2024-08-02[Supabase Docs, `https://docs-hhahn5n6u-supabase.vercel.app/docs/guides/auth/redirect-urls`])

- **Supabase Environments のベストプラクティス記事（2025）**  
  “The Vibe Coder’s Guide to Supabase Environments” では、prod と dev で Supabase プロジェクトそのものを分け、Vercel の preview を dev プロジェクトに向ける構成が紹介されている。これによりデータ汚染を避け、環境差分を明確化できる。  
  （Supabase blog MDX, 2025-08-17[Supabase, `https://github.com/supabase/supabase/blob/master/apps/www/_blog/2025-08-17-the-vibe-coders-guide-to-supabase-environments.mdx`])

- **Next.js Environment Variables ガイドの刷新（2024–2025）**  
  Next.js App Router の環境変数ガイドが更新され、`NEXT_PUBLIC_` プレフィックス・runtime eval（`noStore()` や dynamic 関数を使った `process.env` 参照）・Docker/マルチ環境を意識したパターンが整理された。Supabase 用の URL/キーの持ち方にも直接関係する。  
  （App Router Environment Variables guide, 2025-01-01[Vercel/Next.js, `https://nextjs.org/docs/app/guides/environment-variables`])

- **ローカル開発と CLI v2 / config-as-code（2024）**  
  Supabase CLI v2 と config-as-code の記事では、`supabase/config.toml` と `.env` による環境設定、`additional_redirect_urls` による Vercel preview ワイルドカード設定などが紹介され、ローカル～CI～本番で同じ設定ファイルを使うワークフローが推奨されている。  
  （CLI v2 config-as-code blog, 2024-12-04[Supabase, `https://github.com/supabase/supabase/blob/master/apps/www/_blog/2024-12-04-cli-v2-config-as-code.mdx`])

---

## Key Findings（要点とエビデンス）✅

- **GitHub ログインは「Supabase ↔ GitHub OAuth App ↔ Next.js」の 3 つの設定が一致している必要がある**  
  Supabase 公式ガイドは、GitHub OAuth App の callback を Supabase の `/auth/v1/callback` に設定し、Supabase 側で GitHub プロバイダを有効化してから、アプリ側で `signInWithOAuth` と `redirectTo` を使う流れを定義している。  
  （“Login with GitHub”, 2025-11-12[Supabase, `https://supabase.com/docs/guides/auth/social-login/auth-github`])

- **Next.js App Router では `@supabase/ssr` を使った server-side auth が公式推奨**  
  `createServerClient` / `createBrowserClient` を使い、App Router の Server Components / Server Actions から Supabase Auth を扱うパターンがガイドで示されている。  
  （“Setting up Server-Side Auth for Next.js”, 2024-07-13[Supabase Docs, `https://docs-2ej5s7s9m-supabase.vercel.app/docs/guides/auth/server-side/nextjs`])

- **Redirect URLs は Supabase の `redirectTo` と Auth 設定で制御し、GitHub 側は Supabase の callback のみ**  
  Supabase の Redirect URLs ガイドは、`redirectTo` に環境ごとの URL を渡すことと、`NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_VERCEL_URL` から URL を導出する `getURL()` ヘルパーを提示している。  
  （“Redirect URLs”, 2024-08-02[Supabase Docs, `https://docs-hhahn5n6u-supabase.vercel.app/docs/guides/auth/redirect-urls`])

- **Supabase プロジェクトは環境ごと（prod / dev）に分けることが推奨される**  
  Environments ガイドでは、1 プロジェクトに複数環境を詰め込むのではなく、Vercel の preview を dev プロジェクト、本番を prod プロジェクトに向ける構成が示されている。  
  （“The Vibe Coder’s Guide to Supabase Environments”, 2025-08-17[Supabase, `https://github.com/supabase/supabase/blob/master/apps/www/_blog/2025-08-17-the-vibe-coders-guide-to-supabase-environments.mdx`])

- **環境変数の管理は Next.js / Vercel の標準機能で完結できる**  
  Next.js の App Router ガイドは `.env.local` での設定と `NEXT_PUBLIC_` プレフィックスの扱い、Vercel ドキュメントはプロジェクトごとの Environment Variables（Production / Preview / Development）の使い分けを解説している。  
  （Environment Variables guide, 2025-01-01[Vercel/Next.js, `https://nextjs.org/docs/app/guides/environment-variables`]; Vercel docs “Environment Variables”, 2025-01 頃[Vercel, `https://vercel.com/docs/projects/environment-variables`])

- **GitHub は callback URL のワイルドカードをサポートしないため、Supabase 側のワイルドカード設定と混同しないことが重要**  
  Supabase の config-as-code 記事は `additional_redirect_urls` で Vercel preview 用のワイルドカードを設定する例を挙げる一方で、GitHub OAuth App 側ではワイルドカードが許可されないことが GitHub/Supabase のディスカッションや Q&A で繰り返し言及されている。  
  （CLI v2 config-as-code blog, 2024-12-04[Supabase, `https://github.com/supabase/supabase/blob/master/apps/www/_blog/2024-12-04-cli-v2-config-as-code.mdx`]; GitHub Discussion 20353, 2024[Supabase, `https://github.com/orgs/supabase/discussions/20353`])

- **Stack Overflow でも「Next 14 + Supabase Auth + redirectTo が preview で期待通り動かない」事例が報告されている**  
  問題の多くは、Supabase Auth の URL 設定と `redirectTo` 先、Vercel のドメイン設定が揃っていないことに起因する、という指摘が複数回答でなされている。  
  （“Supabase Auth with Next 14 (app router) redirectTo…”, 2024-03-25[Stack Overflow, `https://stackoverflow.com/questions/78220204/supabase-auth-with-next-14-app-router-redirectto`])

- **ローカル DB を Supabase CLI で立てる場合も、Auth/GitHub 設定は `.env` と `config.toml` 経由で同じモデルに統一できる**  
  Local development overview は、`SUPABASE_AUTH_GITHUB_CLIENT_ID/SECRET` を `.env` に置き、`supabase/config.toml` の `auth.external.github` セクションから `env()` で参照する構成を説明している。  
  （Local Development overview, 2023–2024[Supabase Docs, `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/local-development/overview.mdx`])

---

## Contradictions / Open Questions 🤔

- **矛盾 1：Supabase プロジェクトを 1 つにまとめるか、環境ごとに分けるか**  
  一部のブログや古いチュートリアルでは「1 つの Supabase プロジェクトを使い、テーブル内で環境フラグなどで分ける」案が紹介されているが、最新の Supabase 環境ガイドと開発者ブログは「prod/dev でプロジェクトを分ける」ことを強く推奨している。  
  （一般ブログ例：Supabase Auth Next.js setup guide, 2023–2024[Zestminds, `https://www.zestminds.com/blog/supabase-auth-nextjs-setup-guide/`]; 対して Supabase environments blog, 2025-08-17[Supabase, `https://github.com/supabase/supabase/blob/master/apps/www/_blog/2025-08-17-the-vibe-coders-guide-to-supabase-environments.mdx`])

- **矛盾 2：GitHub OAuth callback のワイルドカード利用可否**  
  古いブログや一部記事では GitHub 側 callback にワイルドカードを使うような表現が見られるが、GitHub OAuth の仕様としては正確な URL の一致が必要であり、Supabase / GitHub のディスカッションや 2024 年の Q&A がこれを裏付けている。  
  （GitHub OAuth docs, 2023–2024[GitHub, `https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps`]; Supabase GitHub Discussion 20353, 2024[Supabase, `https://github.com/orgs/supabase/discussions/20353`])

- **Open Question：Supabase の「Publishable Key」と旧「Anon Key」の移行タイミング**  
  Supabase ドキュメントの一部では `NEXT_PUBLIC_SUPABASE_ANON_KEY`、別の箇所では `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` を推奨しており、両者が併存している時期がある。実際のプロジェクトでは Supabase ダッシュボードの表記と最新の Quickstart を優先し、どちらを使うか決める必要がある。  
  （Next.js Quickstart, 2023–2024[Supabase, `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/getting-started/quickstarts/nextjs.mdx`]; UI library docs, 2024[Supabase, `https://github.com/supabase/supabase/blob/master/apps/ui-library/content/docs/nextjs/password-based-auth.mdx`])

- **Open Question：ローカル DB を完全ローカルにするか、dev プロジェクトを「ローカル用」とみなすか**  
  Supabase CLI による完全ローカル DB と、Supabase Cloud 上の dev プロジェクトを「ローカル用」として使うパターンが共存しており、どちらが適切かはチームの運用方針とインフラ権限（ポート開放・Docker 利用可否）によって変わる。  
  （Local Development YouTube, 2024-03-08[Supabase, `https://www.youtube.com/watch?v=Gbf-E3H824k`]; MakerKit Next Supabase starter docs, 2025-11-10[MakerKit, `https://makerkit.dev/docs/next-supabase/configuration/environment-variables`])

---

## Supabase + GitHub ログイン + Production / Local DB セットアップ手順（Markdown ガイド）📝

以下は **Next.js App Router（14/15 想定） + Supabase + Vercel** を前提とした、GitHub ログインと Production / Local 用 DB（= Supabase プロジェクト）構成のガイドです。  
コード例はすべて **公式ドキュメントからの参考抜粋** であり、そのままではなく自プロジェクトに合わせて調整が必要です。

---

### 1. 準備するもの

- **アカウント**
  - Supabase アカウント（`https://supabase.com/`）
  - GitHub アカウント
  - Vercel アカウント（Next.js プロジェクトを接続済み）

- **Next.js プロジェクト**
  - App Router を利用（`app/` ディレクトリ構成）
  - デプロイ先：Vercel

---

### 2. Supabase プロジェクト構成（Production / Local 用 DB 分離）

- **ステップ 2-1：Supabase プロジェクトを 2 つ作成**
  - 例：
    - `myapp-dev`（開発・ローカル・Vercel preview 用）
    - `myapp-prod`（本番用）
  - 理由：
    - プロジェクト単位で **DB / Auth 設定 / Storage 等が完全に分離** されるため、データ汚染を防げる。  
    （Supabase environments blog, 2025-08-17[Supabase, `https://github.com/supabase/supabase/blob/master/apps/www/_blog/2025-08-17-the-vibe-coders-guide-to-supabase-environments.mdx`])

- **ステップ 2-2：各プロジェクトの API 情報を控える**
  - Supabase ダッシュボード → 対象プロジェクト → **Settings → API**
    - `Project URL`（例：`https://xxxx.supabase.co`）
    - `anon key` / `publishable key`
  - これらを後で Next.js の環境変数に設定する。

---

### 3. GitHub OAuth App の作成（prod / dev それぞれ）

Supabase 公式は **「各 Supabase プロジェクトごとに GitHub OAuth App を用意」** する構成を前提にしているため、ここでは prod/dev それぞれ個別に作成する想定で記載します。  
（“Login with GitHub”, 2025-11-12[Supabase, `https://supabase.com/docs/guides/auth/social-login/auth-github`])

- **ステップ 3-1：GitHub OAuth App（dev 用）**
  - GitHub → `Settings` → `Developer settings` → `OAuth Apps` → `New OAuth App`
  - 入力例（dev 用）：
    - **Application name**：`myapp-dev`
    - **Homepage URL**：`http://localhost:3008/`（後で変更可）
    - **Authorization callback URL**：  
      `https://<YOUR_DEV_PROJECT>.supabase.co/auth/v1/callback`
  - 作成後、**Client ID / Client Secret** を控える。

- **ステップ 3-2：GitHub OAuth App（prod 用）**
  - 同様に、新しい OAuth App を作成：
    - **Authorization callback URL**：  
      `https://<YOUR_PROD_PROJECT>.supabase.co/auth/v1/callback`
  - それぞれの Supabase プロジェクトに対応した **Client ID / Secret** が出来上がる。

⚠️ GitHub 側は callback URL のワイルドカードをサポートしないため、Supabase プロジェクトごとに明示的な URL を設定する必要があります。  
（GitHub OAuth docs, 2023–2024[GitHub, `https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps`])

---

### 4. Supabase 側で GitHub プロバイダを有効化

- **ステップ 4-1：Supabase ダッシュボードで設定**
  - プロジェクト（dev も prod も同様に）
    - `Authentication → Providers → GitHub`
    - `Enabled` を ON
    - さきほど作成した GitHub OAuth App の
      - `Client ID`
      - `Client Secret`
      を入力し保存。

- **ステップ 4-2：redirect URL の許可設定（Supabase 側）**
  - `Authentication → URL Configuration` もしくは Auth 設定セクションで、以下を追加（例）：
    - `http://localhost:3008/auth/callback`
    - `https://your-preview-domain.vercel.app/auth/callback`（複数 preview がある場合はワイルドカードも可）
    - `https://your-production-domain.com/auth/callback`
  - config-as-code を使う場合の例（Supabase blog より）：

```toml
[auth]
additional_redirect_urls = [
  "https://*-supabase.vercel.app/*/*",
  "https://supabase.com/*/*",
  "http://localhost:3008/*/*",
]
```

（CLI v2 config-as-code blog, 2024-12-04[Supabase, `https://github.com/supabase/supabase/blob/master/apps/www/_blog/2024-12-04-cli-v2-config-as-code.mdx`])

---

### 5. Next.js（ローカル）用の環境変数設定

- **ステップ 5-1：`.env.local` を作成**
  - Next.js プロジェクトのルートに `.env.local` を作成し、**dev プロジェクトの Supabase 情報** を設定します。  
    （Next.js Quickstart, 2023–2024[Supabase, `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/getting-started/quickstarts/nextjs.mdx`])

```dotenv
# Supabase dev プロジェクト
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR_DEV_PROJECT>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<YOUR_DEV_PUBLISHABLE_OR_ANON_KEY>

# 通常はサイト URL も指定
NEXT_PUBLIC_SITE_URL=http://localhost:3008
```

- **ステップ 5-2：`redirectTo` 用 URL を環境から生成（参考）**

Supabase の Redirect URLs ガイドにある `getURL()` ヘルパー例（Next.js 向け）：

```javascript
const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ??      // Production 用
    process?.env?.NEXT_PUBLIC_VERCEL_URL ??    // Vercel 自動設定
    'http://localhost:3008/'

  // http/https の付与
  url = url.startsWith('http') ? url : `https://${url}`
  // 末尾スラッシュ
  url = url.endsWith('/') ? url : `${url}/`
  return url
}
```

（“Redirect URLs”, 2024-08-02[Supabase Docs, `https://docs-hhahn5n6u-supabase.vercel.app/docs/guides/auth/redirect-urls`])

---

### 6. Vercel（Preview / Production）用の環境変数設定

- **ステップ 6-1：Vercel プロジェクト設定**
  - Vercel ダッシュボード → 対象プロジェクト → `Settings → Environment Variables`
  - 以下を設定（例）：

  - **Production Environment（本番）**
    - `NEXT_PUBLIC_SUPABASE_URL = https://<YOUR_PROD_PROJECT>.supabase.co`
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = <YOUR_PROD_KEY>`
    - `NEXT_PUBLIC_SITE_URL = https://your-production-domain.com`

  - **Preview Environment（プレビュー / ブランチ用）**
    - `NEXT_PUBLIC_SUPABASE_URL = https://<YOUR_DEV_PROJECT>.supabase.co`
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = <YOUR_DEV_KEY>`
    - `NEXT_PUBLIC_SITE_URL = https://<your-project>-<hash>.vercel.app`

  - **Development Environment（ローカル用）**
    - 通常は `.env.local` で管理し、`vercel env pull .env.local` で同期も可能。  
      （Next.js docs, 2025-01-01[Vercel/Next.js, `https://nextjs.org/docs/app/guides/environment-variables`])

---

### 7. Next.js 側の Supabase クライアントと GitHub ログイン（実装イメージ）

> ※ここは **公式ドキュメントからの参考パターン** であり、実際には自プロジェクトに合わせて実装してください（この回答では新しいコードは生成せず、構成の説明のみ行います）。

- **ステップ 7-1：`@supabase/ssr` のインストール**
  - 参考：  
    `npm install @supabase/supabase-js @supabase/ssr`  
    （“Setting up Server-Side Auth for Next.js”, 2024-07-13[Supabase Docs]）

- **ステップ 7-2：Server / Browser クライアントのユーティリティを用意**
  - Supabase ドキュメントの例では、以下のようなユーティリティ関数を用意しています：

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component から呼ばれた場合などの例外ケース
          }
        },
      },
    }
  )
}
```

（Supabase server-side Next.js guide[Supabase, `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/server-side/nextjs.mdx`])

- **ステップ 7-3：Server Action で `signInWithOAuth` を呼び出す（イメージ）**
  - Supabase の OAuth ガイドでは、GitHub ログインを以下のような形で呼び出す例が示されています（PKCE フロー）：

```javascript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: getURL(), // 上で定義した getURL() を利用
  },
})
```

（OAuth PKCE flow partial, 2023–2024[Supabase Docs, `https://github.com/supabase/supabase/blob/master/apps/docs/content/_partials/oauth_pkce_flow.mdx`])

- **ステップ 7-4：`/auth/callback` ルートでセッションを処理**
  - App Router では、`app/auth/callback/route.ts` やページコンポーネントでセッション取得 (`supabase.auth.getSession()` / `getUser()` など) を行うパターンがガイドに掲載されています。  
    （Server-side auth + Next.js guide, 2024-07-13[Supabase Docs]）

---

### 8. ローカル DB を Supabase CLI で立てる場合（オプション）

**「local = Supabase CLI / Docker 上の完全ローカルスタック」として扱いたい場合のパターンです。**  
（Local development overview, 2023–2024[Supabase Docs, `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/local-development/overview.mdx`])

- **ステップ 8-1：Supabase CLI の導入**
  - 公式手順に従い `npm create supabase` もしくは `brew` / `npm` などでインストール。

- **ステップ 8-2：プロジェクト初期化と起動**

```bash
npx supabase init
npx supabase start
```

（Slack clone example README, 2023–2024[Supabase, `https://github.com/supabase/supabase/blob/master/examples/slack-clone/nextjs-slack-clone-dotenvx/README.md`])

- **ステップ 8-3：ローカル用 `.env` と `config.toml`**

  - `supabase/.env` に GitHub OAuth 用の値を設定：

```dotenv
SUPABASE_AUTH_GITHUB_CLIENT_ID="your-local-github-client-id"
SUPABASE_AUTH_GITHUB_SECRET="your-local-github-client-secret"
```

  - `supabase/config.toml` の一部（ドキュメント例）：

```toml
[auth.external.github]
enabled = true
client_id = "env(SUPABASE_AUTH_GITHUB_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_GITHUB_SECRET)"
redirect_uri = "http://localhost:54321/auth/v1/callback"
```

（Local Development overview[Supabase Docs, `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/local-development/overview.mdx`])

- **ステップ 8-4：Next.js 側はローカル Supabase URL / key を `.env.local` に設定**
  - `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321` など、CLI が出力する URL・キーを使用。

---

### 9. 動作確認チェックリスト ✅

- **ローカル**
  - `npm run dev`（または `pnpm dev`）で起動。
  - トップページなどにある「Sign in with GitHub」ボタンをクリック。
  - GitHub の認可画面が出て、許可すると `http://localhost:3008/auth/callback` に戻る。
  - Supabase ダッシュボードの Auth → Users に GitHub ユーザが追加されている。

- **Vercel Preview**
  - 任意のブランチを push → Vercel が preview デプロイを作成。
  - Preview URL（例：`https://myapp-git-feature-xxx.vercel.app`）から GitHub ログイン。
  - 戻り先が preview URL の `/auth/callback` になり、DB と Users が **dev プロジェクト側** にのみ記録される。

- **Vercel Production**
  - main/master ブランチにマージ → 本番デプロイ。
  - 本番 URL から GitHub ログイン。
  - Users / data が **prod プロジェクト側** にのみ記録される。

Q&A にもある通り、**「ローカルでは動くが preview / prod では redirect がおかしい」** 場合は、  
1) Supabase Auth の URL 設定、2) GitHub OAuth App の callback、3) `redirectTo` の URL、4) Vercel の `NEXT_PUBLIC_SITE_URL` の 4 点が一致しているかを優先的に確認するとよいです。  
（Stack Overflow “Supabase Auth with Next 14 (app router) redirectTo…”, 2024-03-25[Stack Overflow, `https://stackoverflow.com/questions/78220204/supabase-auth-with-next-14-app-router-redirectto`])

---

## Actionable Next Steps（次に読むとよいもの）📚

- **公式ドキュメント**
  - Supabase: Login with GitHub（GitHub OAuth + redirectTo の公式ガイド）  
    `https://supabase.com/docs/guides/auth/social-login/auth-github`
  - Supabase: Redirect URLs（環境変数 + getURL パターン）  
    `https://docs-hhahn5n6u-supabase.vercel.app/docs/guides/auth/redirect-urls`
  - Supabase: Setting up Server-Side Auth for Next.js（App Router + @supabase/ssr）  
    `https://docs-2ej5s7s9m-supabase.vercel.app/docs/guides/auth/server-side/nextjs`
  - Next.js: Environment Variables (App Router)  
    `https://nextjs.org/docs/app/guides/environment-variables`

- **コードホスト / 実装例**
  - Supabase GitHub リポジトリ（docs / examples）  
    `https://github.com/supabase/supabase`
  - Slack clone + Next.js + Supabase example（dotenv + CLI）  
    `https://github.com/supabase/supabase/tree/master/examples/slack-clone/nextjs-slack-clone-dotenvx`

- **Q&A / コミュニティ**
  - Stack Overflow: Supabase Auth with Next 14 redirectTo 問題  
    `https://stackoverflow.com/questions/78220204/supabase-auth-with-next-14-app-router-redirectto`
  - MakerKit Next Supabase Starter docs（環境変数 & OAuth）  
    `https://makerkit.dev/docs/next-supabase/how-to/auth/oauth`

- **設計の参考**
  - Supabase Blog: Vercel Integration and Next.js App Router Support  
    `https://supabase.com/blog/using-supabase-with-vercel`
  - Supabase Blog (MDX): The Vibe Coder’s Guide to Supabase Environments  
    `https://github.com/supabase/supabase/blob/master/apps/www/_blog/2025-08-17-the-vibe-coders-guide-to-supabase-environments.mdx`

---

## Query Log（ツール & クエリの簡易ログ）🔍

- **Exa Web Search**
  - `"Supabase GitHub OAuth Next.js Vercel environment variables local development 2024"`  
  - `"\"Supabase\" \"GitHub\" OAuth Next.js Vercel preview redirect Stack Overflow OR Reddit OR Zenn.dev 2024"`

- **Exa Code Context**
  - `"\"Login with GitHub\" Supabase docs social login next.js example"`

- **Context7**
  - `/supabase/supabase`（トピック: auth social login GitHub Next.js Vercel envs）  
  - `/websites/nextjs`（トピック: environment variables, Vercel deployment）

- **Perplexity Ask**
  - Supabase + GitHub OAuth + Next.js App Router + Vercel + prod/dev separation のベストプラクティス検証と矛盾点の洗い出し（2024–2025 情報優先）

---