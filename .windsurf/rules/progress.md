---
trigger: always_on
description: GitBox プロジェクト進捗状況 - PRD v0.3 実装の現在地と残タスク
globs:
---

# GitBox 進捗状況 📊

**最終更新**: 2025-12-16
**現在のブランチ**: main
**最新コミット**: `190ac34` - feat: GitBox PRD v0.3 完全実装

---

## ⚠️ 重要：進捗更新ルール

> **タスク完了時は必ずこのファイルを更新すること！**

### 更新タイミング

1. **GitHub Issue を Close した時** → 該当 Issue を「未実装」から「実装済み」へ移動
2. **新機能を実装した時** → 「✅ 実装済み機能」セクションに追加
3. **新しいバグ/Issue を発見した時** → 「❌ 未実装・バグ」セクションに追加
4. **コミット/マージした時** → 「最新コミット」を更新
5. **フェーズが進んだ時** → 「プロジェクトフェーズ」の状態を更新

### 更新方法

```bash
# Issue をクローズした場合の例
gh issue close #2  # GitHub Issue をクローズ
# → このファイルの #2 を「未実装」から削除し「実装済み」に追加
```

### Issue 状態の確認

```bash
gh issue list --state open   # 未完了 Issue 一覧
gh issue list --state closed # 完了 Issue 一覧
```

---

## 🎯 プロジェクトフェーズ

| フェーズ                  | 状態      | 説明                                 |
| ------------------------- | --------- | ------------------------------------ |
| Phase 1: MVP              | 🟡 進行中 | 基本機能は実装済み、一部バグ修正必要 |
| Phase 2: セキュリティ強化 | ⏳ 未着手 | 2FA、鍵ローテーション                |
| Phase 3: 完全版           | ⏳ 未着手 | 外部連携、完全な Maintenance Mode    |

---

## ✅ 実装済み機能

### 認証・ユーザー管理

- [x] GitHub OAuth 認証
- [x] Supabase Auth 連携
- [x] provider_token の Cookie 保存
- [x] Sign out 機能

### Kanban Board

- [x] Board 作成・一覧表示
- [x] StatusList (列) CRUD
- [x] RepoCard D&D (dnd-kit)
- [x] WIP Limit 表示・警告
- [x] Undo 機能 (Z key)
- [x] 楽観的 UI 更新

### Repository 追加

- [x] GitHub Repository 検索
- [x] 複数選択・一括追加
- [x] 重複検知
- [x] Virtual Scrolling (100+ repos)
- [x] Owner/Visibility フィルター

### Project Info Modal

- [x] Quick Note (300文字)
- [x] Links (Production/Tracking/Supabase)
- [x] Credentials 3パターン
  - [x] Reference (URL)
  - [x] Encrypted (AES-256-GCM)
  - [x] External (1Password等)
- [x] マスク表示・30秒自動マスク

### Maintenance Mode

- [x] Grid/List 切替
- [x] 検索・ソート
- [x] GitHub リンク

### UI/UX

- [x] 12テーマ (Light 6 + Dark 6)
- [x] i18n (英語/日本語)
- [x] Command Palette (⌘K)
- [x] Shortcuts Help (? key)
- [x] Sidebar ナビゲーション

### バックエンド

- [x] Supabase スキーマ (7テーブル)
- [x] RLS ポリシー
- [x] Server Actions
- [x] AES-256-GCM 暗号化
- [x] 監査ログ Server Actions

---

## ❌ 未実装・バグ (GitHub Issues)

### 🟠 P1: 高優先度

| Issue | タイトル                                                              | 概要                                                                |
| ----- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| #3    | /boards/favorites ページの実装                                        | Sidebar リンクあるがページなし                                      |
| #4    | Restore to Board 機能                                                 | TODO のまま未実装                                                   |
| #5    | Move to Maintenance 機能                                              | 実装確認・完成が必要                                                |
| #12   | Production Supabase プロジェクト作成 + Vercel Production デプロイ設定 | 本番環境（Supabase prod + Vercel prod）を整備してリリース可能にする |

### 🟡 P2: 中優先度

| Issue | タイトル          | 概要                          |
| ----- | ----------------- | ----------------------------- |
| #6    | Topics フィルター | AddRepositoryCombobox の TODO |
| #7    | Settings 永続化   | トグル状態が保存されない      |
| #8    | 監査ログ記録      | Reveal/Copy 時に未記録        |
| #9    | Shortcuts リンク  | クリックでモーダル開かない    |

### 🟢 P3: セキュリティ (Phase 2)

| Issue | タイトル             | 概要           |
| ----- | -------------------- | -------------- |
| #10   | 2FA認証必須          | 暗号化値復号時 |
| #11   | 90日鍵ローテーション | KMS統合含む    |

---

## 🛠️ 技術スタック確認

### フロントエンド

```
Next.js 15 (App Router)
React 19
TypeScript 5
Redux Toolkit
Tailwind CSS + shadcn/ui
@dnd-kit (D&D)
framer-motion (アニメーション)
@tanstack/react-virtual (仮想スクロール)
```

### バックエンド

```
Supabase (PostgreSQL + Auth)
Server Actions
Web Crypto API (AES-256-GCM)
```

### 開発ツール

```
pnpm (monorepo)
Vitest (単体テスト)
Playwright (E2E)
ESLint v9
```

---

## 📁 主要ファイル

| パス                                           | 説明                  |
| ---------------------------------------------- | --------------------- |
| `app/page.tsx`                                 | Landing Page (要修正) |
| `app/board/[id]/BoardPageClient.tsx`           | Kanban ボード         |
| `app/maintenance/MaintenanceClient.tsx`        | Maintenance Mode      |
| `app/settings/SettingsClient.tsx`              | 設定画面              |
| `components/Board/KanbanBoard.tsx`             | Kanban コア           |
| `components/Board/AddRepositoryCombobox.tsx`   | Repository 追加       |
| `components/Modals/ProjectInfoModal.tsx`       | Project Info          |
| `components/CommandPalette/CommandPalette.tsx` | ⌘K                    |
| `lib/actions/`                                 | Server Actions        |
| `lib/encryption.ts`                            | AES-256-GCM           |
| `supabase/migrations/`                         | DB スキーマ           |

---

## 🚀 次のアクション

### 推奨対応順序

1. **#2 Landing Page 修正** - 製品の顔を整える
2. **#4, #5 Maintenance 機能** - 基本フローの完成
3. **#3 Favorites ページ** - Sidebar との整合性
4. **#7 Settings 永続化** - UX 改善
5. **P2 その他** - 細かい改善
6. **P3 セキュリティ** - Phase 2 で対応

### 開発コマンド

```bash
pnpm dev          # 開発サーバー (localhost:3008)
pnpm build        # ビルド
pnpm test         # Vitest
pnpm test:e2e     # Playwright
```

---

## 📝 備考

- Supabase Cloud プロジェクト: `gitbox-dev` (jqtxjzdxczqwsrvevmyk)
- GitHub OAuth 設定済み
- Vercel Preview 用の環境変数設定が必要
- `.env.local` は `.gitignore` 済み
