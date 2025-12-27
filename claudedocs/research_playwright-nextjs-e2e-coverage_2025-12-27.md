# Playwright + Next.js E2E カバレッジ調査レポート

**調査日**: 2025-12-27
**信頼度**: 90% (HIGH)
**結論**: **可能** - V8 Coverage + monocart-reporter で実現可能

---

## Executive Summary

PlaywrightでNext.js E2Eテストのカバレッジ計測は**可能**です。最も推奨されるアプローチは **V8 Coverage** と **monocart-reporter** の組み合わせで、以下の特徴があります：

| 項目                         | 対応状況                                         |
| ---------------------------- | ------------------------------------------------ |
| クライアントサイドカバレッジ | ✅ 対応 (Chromiumのみ)                           |
| サーバーサイドカバレッジ     | ✅ 対応 (NODE_V8_COVERAGE)                       |
| SWC (Babel不要)              | ✅ 対応                                          |
| レポート形式                 | lcov, HTML, JSON, text-summary                   |
| 実働例                       | https://github.com/cenfun/nextjs-with-playwright |

---

## 技術的アプローチ

### 1. V8 Coverage (推奨)

Playwrightの`page.coverage`APIを使用してV8ネイティブカバレッジを収集します。

#### Playwright Coverage API

```typescript
// クライアントサイドカバレッジ収集
await page.coverage.startJSCoverage({
  resetOnNavigation: false,
  reportAnonymousScripts: false,
})
await page.coverage.startCSSCoverage({
  resetOnNavigation: false,
})

// テスト実行
await page.goto('http://localhost:3000')
// ... E2Eテスト操作 ...

// カバレッジ停止・取得
const [jsCoverage, cssCoverage] = await Promise.all([
  page.coverage.stopJSCoverage(),
  page.coverage.stopCSSCoverage(),
])
```

**制限事項**:

- `page.coverage`はChromiumでのみ動作
- Firefox/WebKitでは利用不可

### 2. monocart-reporter 統合

monocart-reporter は Playwright と完全に統合されており、V8カバレッジを自動収集します。

#### インストール

```bash
pnpm add -D monocart-reporter monocart-coverage-reports
```

#### playwright.config.ts 設定

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  reporter: [
    ['list'],
    [
      'monocart-reporter',
      {
        name: 'GitBox E2E Coverage Report',
        outputFile: './coverage-report/index.html',
        coverage: {
          // V8 カバレッジを有効化
          entryFilter: {
            '**/node_modules/**': false,
            '**/.next/**': false,
          },
          sourceFilter: {
            '**/components/**': true,
            '**/lib/**': true,
            '**/app/**': true,
          },
          reports: [['v8'], ['html'], ['lcov'], ['text-summary']],
        },
      },
    ],
  ],
  // Chromiumのみ使用（カバレッジ要件）
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
```

### 3. サーバーサイドカバレッジ

Next.jsサーバーサイドコードのカバレッジ収集には`NODE_V8_COVERAGE`環境変数を使用します。

#### 起動スクリプト

```bash
# サーバーサイドカバレッジを有効にしてNext.jsを起動
NODE_V8_COVERAGE=./coverage-server next dev
```

または `package.json`:

```json
{
  "scripts": {
    "dev:coverage": "NODE_V8_COVERAGE=./coverage-server next dev",
    "test:e2e:coverage": "NODE_V8_COVERAGE=./coverage-server playwright test"
  }
}
```

### 4. 完全な統合例

参考リポジトリ: https://github.com/cenfun/nextjs-with-playwright

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  webServer: {
    command: 'NODE_V8_COVERAGE=./coverage-server pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  reporter: [
    ['list'],
    [
      'monocart-reporter',
      {
        name: 'E2E Coverage Report',
        outputFile: './coverage-report/index.html',
        coverage: {
          entryFilter: (entry) => {
            // node_modules と .next を除外
            if (entry.url.includes('node_modules')) return false
            if (entry.url.includes('.next')) return false
            return true
          },
          sourceFilter: (sourcePath) => {
            // アプリケーションソースのみ
            return (
              sourcePath.includes('components/') ||
              sourcePath.includes('lib/') ||
              sourcePath.includes('app/')
            )
          },
          reports: [
            ['v8'],
            ['html', { subdir: 'html' }],
            ['lcov'],
            ['text-summary'],
            ['json', { file: 'coverage.json' }],
          ],
        },
      },
    ],
  ],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
```

---

## 代替アプローチ

### Istanbul/NYC アプローチ (非推奨)

Istanbul/NYCを使用する場合、Babelインストルメンテーションが必要になり、Next.jsのSWCコンパイラとの互換性問題が発生します。

```bash
# 必要なパッケージ
pnpm add -D nyc @istanbuljs/nyc-config-typescript babel-plugin-istanbul
```

**問題点**:

- SWC → Babel への切り替えが必要
- ビルド速度の低下
- 設定の複雑さ

### v8-to-istanbul 変換

Playwright V8カバレッジをIstanbul形式に変換できます。

```typescript
const v8toIstanbul = require('v8-to-istanbul')

for (const entry of coverage) {
  const converter = v8toIstanbul('', 0, { source: entry.source })
  await converter.load()
  converter.applyCoverage(entry.functions)
  console.log(JSON.stringify(converter.toIstanbul()))
}
```

---

## GitBox への適用推奨

### 実装ステップ

1. **パッケージ追加**

   ```bash
   pnpm add -D monocart-reporter monocart-coverage-reports
   ```

2. **playwright.config.ts 更新**
   - monocart-reporter を追加
   - カバレッジ設定を追加
   - Chromiumプロジェクトのみに限定

3. **package.json スクリプト追加**

   ```json
   {
     "scripts": {
       "test:e2e:coverage": "NODE_V8_COVERAGE=./coverage-server playwright test --project=chromium"
     }
   }
   ```

4. **.gitignore 更新**
   ```
   coverage-report/
   coverage-server/
   ```

### 注意事項

- E2Eカバレッジはユニットテストカバレッジとは異なる視点を提供
- E2Eカバレッジはユーザーフロー検証に有用、ユニットテストは分岐網羅に有用
- 両方を組み合わせることで包括的な品質保証が可能

---

## 参考資料

- [Playwright Coverage API](https://playwright.dev/docs/api/class-coverage)
- [monocart-coverage-reports](https://github.com/cenfun/monocart-coverage-reports)
- [Next.js with Playwright 実装例](https://github.com/cenfun/nextjs-with-playwright)
- [V8 Coverage Format](https://v8.dev/blog/javascript-code-coverage)

---

## 結論

| 質問                                        | 回答                            |
| ------------------------------------------- | ------------------------------- |
| PlaywrightでNext.js E2Eカバレッジは可能か？ | **YES**                         |
| 推奨アプローチ                              | V8 Coverage + monocart-reporter |
| SWC対応                                     | YES (Babel不要)                 |
| 設定難易度                                  | 中程度 (reporter設定のみ)       |
| 制限事項                                    | Chromiumのみ対応                |
