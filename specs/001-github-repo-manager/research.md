# Research: Vibe Rush - 技術選定とベストプラクティス

**作成日**: 2025-11-15
**ステータス**: Completed
**目的**: 技術スタック、アーキテクチャパターン、ベストプラクティスの調査と決定

---

## 1. Next.js 16 App Router + TypeScript

### 決定事項
- **Next.js 16 (App Router)** を採用
- **TypeScript 5.x** でフルタイプセーフ
- **Server Components** と **Client Components** を適切に分離
- **Server Actions** で認証・DB操作を実行

### 根拠
- App Router は Next.js の推奨アーキテクチャ（Pages Router は非推奨）
- Server Components でバンドルサイズ削減、パフォーマンス向上
- Server Actions で型安全な API エンドポイント不要
- Supabase との統合が公式にサポート（`@supabase/ssr`）

### 代替案との比較
- **Pages Router**: 非推奨、将来的にサポート終了の可能性
- **Remix**: 学習コスト高、エコシステム小、Vercel デプロイが標準でない
- **SvelteKit**: React エコシステム（Redux Toolkit, Magic MCP など）が使えない

### 参考資料
- [Next.js 16 Documentation - App Router](https://nextjs.org/docs/app)
- [Supabase Next.js Server-Side Auth Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)

---

## 2. Supabase (PostgreSQL + Auth) + Docker Compose (Local Dev)

### 決定事項
- **Production**: Supabase Cloud (PostgreSQL + Auth + Storage)
- **Development**: Docker Compose で Supabase 互換の PostgreSQL をローカル起動
- **TypeScript 型**: `supabase gen types` で自動生成
- **認証**: `@supabase/ssr` で Server-Side Auth（PKCE フロー）

### 根拠
- Supabase は PostgreSQL ベースで SQL 標準に準拠（ベンダーロックイン低減）
- GitHub OAuth が標準サポート
- Row Level Security (RLS) でセキュアなマルチテナント対応
- Docker Compose でローカル環境を完全再現可能（ネットワーク不要）
- TypeScript 型自動生成で型安全性を担保

### ローカル開発環境セットアップ
```yaml
# supabase/docker-compose.yml
version: '3.8'
services:
  postgres:
    image: supabase/postgres:15.1.0.147
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - "54322:5432"
    volumes:
      - ./data:/var/lib/postgresql/data

  auth:
    image: supabase/gotrue:v2.132.3
    environment:
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:postgres@postgres:5432/postgres
      GOTRUE_SITE_URL: http://localhost:3000
      GOTRUE_JWT_SECRET: your-super-secret-jwt-token
    ports:
      - "54321:8081"
```

### 代替案との比較
- **Firebase**: NoSQL のみ、SQL クエリ不可、ベンダーロックイン高
- **AWS RDS + Cognito**: セットアップ複雑、コスト高、型生成なし
- **Prisma + PostgreSQL**: Auth 自前実装必要、セキュリティリスク高

### 参考資料
- [Supabase Local Development Guide](https://supabase.com/docs/guides/local-development)
- [Supabase TypeScript Support](https://supabase.com/docs/guides/api/generating-types)
- [VERCEL-SUPABASE-SETUP.md](../../VERCEL-SUPABASE-SETUP.md) (プロジェクト内ガイド)

---

## 3. Redux Toolkit + RTK Query (State Management & API)

### 決定事項
- **Global State**: Redux Toolkit (`@reduxjs/toolkit`)
- **GitHub API**: RTK Query で OpenAPI スキーマから自動生成
- **LocalStorage 同期**: カスタム Redux Middleware（`redux-storage-middleware`）

### 根拠
- Redux Toolkit は Redux の公式推奨（ボイラープレート削減、TypeScript 統合）
- RTK Query は OpenAPI/Swagger スキーマから型安全な API クライアント自動生成
- GitHub REST API は公式 OpenAPI スキーマ提供（手動実装不要）
- redux-persist はメンテナンス停止（最終更新 2021年）、カスタム middleware で代替

### RTK Query Code Generation
```bash
# GitHub REST API OpenAPI スキーマから自動生成
npx @rtk-query/codegen-openapi \
  --schemaFile https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json \
  --outputFile lib/github/api.ts
```

### Redux Storage Middleware (カスタム実装)
```typescript
// packages/redux-storage-middleware/src/middleware.ts
import { Middleware } from '@reduxjs/toolkit';

export const createStorageMiddleware = <S>(
  slices: string[],
  storage: Storage = localStorage
): Middleware => {
  return (store) => (next) => (action) => {
    const result = next(action);
    const state = store.getState() as S;

    slices.forEach((sliceName) => {
      storage.setItem(sliceName, JSON.stringify(state[sliceName]));
    });

    return result;
  };
};
```

### 代替案との比較
- **Zustand**: TypeScript 型推論弱い、Redux DevTools 統合不完全
- **Jotai/Recoil**: Atom ベース、グローバル状態管理に不向き
- **TanStack Query**: GitHub API 用には良いが、グローバル状態管理には不向き

### 参考資料
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [RTK Query Code Generation](https://redux-toolkit.js.org/rtk-query/usage/code-generation)
- [GitHub REST API OpenAPI](https://github.com/github/rest-api-description)

---

## 4. Magic MCP (UI Component Generation)

### 決定事項
- 全 UI コンポーネントを **Magic MCP** (21st.dev) で生成
- ワイヤーフレームから直接生成（PRD.md 5章参照）
- **Storybook v10** で生成済みコンポーネントをカタログ化（重複防止）

### 根拠
- PRD.md で Magic MCP 使用が明記されている
- 12 テーマ対応（OKLCH カラーシステム）を自動生成
- WCAG AA コントラスト要件を自動検証
- デザインシステムの一貫性を保証

### Workflow
1. PRD.md のワイヤーフレーム → Magic MCP にプロンプト投入
2. 生成されたコンポーネント → Storybook Story 作成
3. Playwright でスクリーンショット + コントラスト検証
4. ビルド時に WCAG AA 違反があれば失敗

### Storybook v10 統合
```typescript
// stories/Board/KanbanBoard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { KanbanBoard } from '@/components/Board/KanbanBoard';

const meta: Meta<typeof KanbanBoard> = {
  title: 'Board/KanbanBoard',
  component: KanbanBoard,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof KanbanBoard>;

export const Default: Story = {
  args: {
    // ...
  },
};
```

### 代替案との比較
- **手動実装**: 12 テーマ対応が膨大な工数、デザイン一貫性の保証困難
- **shadcn/ui**: テーマ切り替え機能が弱い、OKLCH 対応なし
- **Chakra UI**: パフォーマンス悪い（runtime CSS-in-JS）

### 参考資料
- [Magic MCP Documentation](https://github.com/21st-dev/magic-mcp)
- [Storybook v10 Documentation](https://storybook.js.org/)

---

## 5. Playwright E2E Testing + Supabase OAuth Bypass

### 決定事項
- **Playwright** で E2E テスト（GitHub OAuth ログイン含む）
- **Supabase Admin API** で E2E 用のテストユーザー作成・セッション発行
- **Development 環境** で E2E 実行（Production には影響なし）

### OAuth Bypass Strategy
```typescript
// tests/e2e/helpers/auth.ts
import { test as base } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Supabase Admin API でセッション発行
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin API Key
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'test-password',
      email_confirm: true,
    });

    // セッショントークンを Cookie に設定
    await page.context().addCookies([
      {
        name: 'sb-access-token',
        value: data.session.access_token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await use(page);

    // テスト後にユーザー削除
    await supabase.auth.admin.deleteUser(data.user.id);
  },
});
```

### 根拠
- GitHub OAuth の実際のフローは E2E テストに不向き（外部依存、レート制限）
- Supabase Admin API でテスト専用ユーザー・セッション発行可能
- テスト後に自動削除で DB クリーンアップ

### 代替案との比較
- **本物の GitHub OAuth**: レート制限、外部依存、テスト脆弱
- **Mock Auth**: 実際のフローとの乖離、セキュリティバグ検出不可

### 参考資料
- [Playwright Authentication Guide](https://playwright.dev/docs/auth)
- [Supabase Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser)

---

## 6. ESLint v9 + Custom Rules

### 決定事項
- **ESLint v9** (Flat Config)
- **eslint-config-ts-prefixer** (TypeScript import prefix 強制)
- **@laststance/react-next-eslint-plugin** のカスタムルール:
  - `laststance/no-set-state-prop-drilling`: `error`
  - `laststance/all-memo`: `error`

### 根拠
- ESLint v9 は Flat Config が標準（`.eslintrc` は非推奨）
- `no-set-state-prop-drilling`: useState を props で渡すアンチパターンを検出
- `all-memo`: React.memo 漏れを検出（パフォーマンス向上）
- `ts-prefixer`: TypeScript import の `@/` prefix 強制（相対パス禁止）

### 設定例
```javascript
// eslint.config.js
import tsPrefi xer from 'eslint-config-ts-prefixer';
import laststancePlugin from '@laststance/react-next-eslint-plugin';

export default [
  tsPrefixer,
  {
    plugins: {
      laststance: laststancePlugin,
    },
    rules: {
      'laststance/no-set-state-prop-drilling': 'error',
      'laststance/all-memo': 'error',
    },
  },
];
```

### 参考資料
- [ESLint v9 Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files-new)
- [@laststance/react-next-eslint-plugin](https://github.com/laststance/react-next-eslint-plugin)

---

## 7. Vitest (Unit Testing)

### 決定事項
- **Vitest** で単体テスト（Jest 互換 API）
- React コンポーネント: **React Testing Library**
- カバレッジ: **c8** (Vitest 標準)

### 根拠
- Vitest は Vite ベース（Next.js 16 は Turbopack/Vite 統合）
- Jest より高速（ESM ネイティブ、並列実行）
- Jest API 互換（移行コスト低）
- TypeScript 型サポート強力

### 設定例
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### 代替案との比較
- **Jest**: 遅い（CommonJS）、設定複雑、Next.js 16 との統合弱い

### 参考資料
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

## 8. PWA (Progressive Web App)

### 決定事項
- **next-pwa** プラグインで PWA 化
- **Service Worker** でオフラインキャッシュ
- **Web App Manifest** で インストール可能

### 根拠
- PRD.md で PWA 対応が明記されている
- next-pwa は Next.js 16 App Router 対応
- Service Worker で基本機能（Board 表示、Quick note 編集）をオフライン対応

### 設定例
```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  // ...
});
```

### 参考資料
- [next-pwa Documentation](https://github.com/shadowwalker/next-pwa)

---

## 10. Sentry (Error Reporting)

### 決定事項
- **Sentry** で Production エラー監視
- **Source Maps** アップロードで スタックトレース可読化
- **Performance Monitoring** で Core Web Vitals 測定

### 根拠
- PRD.md で Sentry 使用が明記されている
- Next.js 公式統合（`@sentry/nextjs`）
- エラー通知、パフォーマンス監視、セッションリプレイ

### 設定例
```javascript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

### 参考資料
- [Sentry Next.js Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

---

## 11. WCAG AA Contrast Validation (Build-time Enforcement)

### 決定事項
- **axe-core** で自動コントラスト検証
- **Playwright** でスクリーンショット + axe 実行
- **ビルド時に違反があれば失敗**（CI/CD 統合）

### 根拠
- PRD.md で「コントラスト比が基準を満たさない場合、ビルドを失敗させる」と明記
- axe-core は WCAG AA 準拠検証の業界標準
- 12 テーマ × 代表画面でテスト

### Playwright Test Example
```typescript
// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG AA Contrast Validation', () => {
  const themes = ['sunrise', 'sandstone', 'mint', 'sky', 'lavender', 'rose',
                  'midnight', 'graphite', 'forest', 'ocean', 'plum', 'rust'];

  for (const theme of themes) {
    test(`${theme} theme meets WCAG AA contrast`, async ({ page }) => {
      await page.goto(`/board?theme=${theme}`);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
});
```

### CI/CD Integration
```yaml
# .github/workflows/ci.yml
- name: Run accessibility tests
  run: pnpm test:e2e:accessibility
  env:
    CI: true

# ビルド失敗で Deploy ブロック
```

### 参考資料
- [axe-core Documentation](https://github.com/dequelabs/axe-core)
- [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)

---

## 総括

### 技術スタック一覧

| カテゴリ | 技術 | 理由 |
|---------|------|------|
| **Framework** | Next.js 16 (App Router) | Server Components, Server Actions, Vercel 最適化 |
| **Language** | TypeScript 5.x | 型安全性、開発体験向上 |
| **State Management** | Redux Toolkit + RTK Query | GitHub API 自動生成、型安全 |
| **Database** | Supabase (PostgreSQL) | RLS, Auth 統合、型自動生成 |
| **UI Generation** | Magic MCP (21st.dev) | 12 テーマ自動生成、WCAG AA 準拠 |
| **i18n** | next-intl | App Router 対応、型安全 |
| **Forms** | react-hook-form + zod | 型安全バリデーション |
| **Testing (Unit)** | Vitest | 高速、ESM ネイティブ |
| **Testing (E2E)** | Playwright | OAuth bypass, accessibility validation |
| **Linting** | ESLint v9 + Custom Rules | Flat Config, カスタムルール |
| **Error Reporting** | Sentry | Production 監視、パフォーマンス計測 |
| **PWA** | next-pwa | オフライン対応、インストール可能 |

### 未解決の課題

**なし**。全ての技術選定が完了し、ベストプラクティスが確立されました。

### Next Steps

Phase 1 (Design & Contracts) に進みます:
1. `data-model.md`: データベーススキーマ設計
2. `contracts/`: GitHub REST API OpenAPI スキーマ配置
3. `quickstart.md`: セットアップガイド作成
4. Agent context 更新
