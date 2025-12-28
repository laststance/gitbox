# GitBox — PRD v0.3 (Unified Edition with Enhanced Security)

## 1) プロダクト概要と情報設計（IA）

- 対応言語
  - 英語
- トップページはログイン、サインインボタンを配置したLandingPage

### ナビゲーションフロー

**Auth\*(Github OAuth)** → **Home (Boards)** → **Board (Kanban)** → **Card Detail (right panel)**

### 主要画面

- **Maintenance Mode**（完了・保守中のプロジェクト保管庫。Sidebarリンクで遷移、Explorer UI）
- **Command Palette (⌘K)**
- **Settings**（Theme/Type/Display/WIP）
- **Shortcuts (?)**

### Kanban基本方針

Board=列、列=Status、D&Dで**列間=状態更新** / **同列上下=優先度変更**。フィルタ/グループ/プロパティ表示はNotion型の考え方を踏襲。

---

## 2) デザインシステム

### 2.1 カラー & タイポグラフィ ガイド

#### カラーシステム

- **OKLCHベース**で段階（L）を揃えたスケールを使用
- ダーク/ライトの**ミラーマッピング**で恒常的なコントラストを保つ
- Harmonizer/Harmonyの知見を参照（[Harmonizer](https://harmonizer.evilmartians.com/)）

#### コントラスト要件

- **本文**：**4.5:1以上**（WCAG AA準拠）
- **UIコンポーネント/アイコン**：**3:1以上**
- 参照：[W3C WCAG 2.1](https://www.w3.org/TR/WCAG21/)

#### タイポグラフィ

- **Base font**：**16px**
- ステップ：1px刻み（最小12px〜推奨28pxまで）
- 運用：アップロード済みOKLCHパレットをソース・オブ・トゥルースとする（Tailwind tokens）

### 2.2 Design Tokens（12 Themes）

#### Token Set（共通キー）

```
color.background         // 画面最下層
color.surface            // カード/パネル
color.surfaceAlt         // サブ面（サイド/ツールバー）
color.border
color.overlay            // モーダル/ツールチップ背景

color.textPrimary
color.textSecondary
color.textMuted
color.focusRing

color.primary
color.primaryFg
color.secondary
color.secondaryFg
color.tertiary
color.tertiaryFg

color.success / warning / danger
```

#### Light Theme（推奨OKLCHレンジ）

- background L≈0.98、surface L≈0.96、surfaceAlt L≈0.92
- textPrimary L対比で**4.5:1以上**、textSecondaryは**3:1以上**
- primary/secondary/tertiary は彩度を活かしつつ、**primaryFg**は常にAA達成（自動で黒/白をスイッチ）

#### Dark Theme（推奨OKLCHレンジ）

- background L≈0.12、surface L≈0.16、surfaceAlt L≈0.20
- textPrimaryは**対比4.5:1以上**になるよう明度差を確保
- primary は**輝度を持ち上げ**てボタン/選択状態で視認性を確保（primaryFgはダーク側で黒/白を自動選択）

#### Theme Names

- **Light:** Sunrise / Sandstone / Mint / Sky / Lavender / Rose
- **Dark:** Midnight / Graphite / Forest / Ocean / Plum / Rust

---

## 3) 機能要件

### 3.1 GitHub OAuth & Repository追加

#### 機能仕様

- Combobox検索（owner/repo, topics, visibility）
- 複数一括追加/重複検知
- 追加直後に"Quick note"へフォーカス

#### 受け入れ基準

- 100+ repos でも候補表示が遅延しない
- D&D/Undoがストレスなく機能

### 3.2 Board（Kanban）

#### 機能仕様

- **列=Status**（例：Suspend / Spec designing / Active / Completed）
- 列CRUD操作、WIP limit設定
- **カード**：repo名、一言メモ、任意メタ（Stars/Updated/Visibility/Language/Topics等）
- **⋯（Overflow menu）**：**Project Info**モーダル起動

#### 受け入れ基準

- Board=Statusフィールド基準
- D&D操作の定石に準拠（[GitHub Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/)）

### 3.3 Maintenance Mode

#### 機能仕様

- Sidebarから遷移
- **Explorer UI**（Grid/List切替、並び替え/検索）
- **クリック＝GitHub repo へ遷移**
- カード右上に**⋯メニュー**
- **復帰（Restore to Board）**や**Hide**操作を提供

#### UI根拠

リスト/テーブル/サイドバーUIのHIG（[Apple Developer](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)）

### 3.4 Project Info（モーダル）

すべてのRepoカードから起動可能

#### Sections

1. **Quick note**（1〜3行）

2. **Links**
   - **Production URL**（複数可）
   - **Tracking services**（GA/GTM/Plausible などのダッシュボードURL）
   - **Supabase Dashboard**（プロジェクト/Branch/Pooler等の参照リンク）

3. **Credentials（3つの管理パターン）**

   ##### パターンA: 参照リンク型

   ダッシュボードでいつでも確認可能なサービス（Supabase等）
   - ダッシュボードへのリンクのみ保存
   - 実際の値はサービス側で管理

   ##### パターンB: 暗号化保存型

   一度きりのシークレット（OAuth Secret等）
   - AES-256-GCM で暗号化してDB保存
   - マスク表示がデフォルト（例: `github_*****xyz789`）

   ##### パターンC: 外部管理型

   1Password/Bitwarden等で管理
   - 外部ツールでの保管場所のみ記録
   - チームVaultへの参照を提供

4. **Integrations**（Webhook/CIなどのメタ）

#### セキュリティ要件（強化版）

##### 暗号化仕様

- アルゴリズム: **AES-256-GCM**
- 鍵管理: **AWS KMS / GCP KMS / Azure Key Vault**
- 鍵ローテーション: **90日ごと**

##### アクセス制御

- 暗号化された値の復号時は**2FA認証必須**
- **RBAC**（役割ベースアクセス制御）
- すべての機密情報アクセスを**監査ログ**に記録

##### 表示制御

- デフォルトは**マスク表示**（`****`）
- "Reveal"ボタンで一時表示（**30秒後に自動マスク**）
- コピー機能使用時は監査ログに記録

---

## 4) インタラクション仕様

### 4.1 Overflow "⋯" Menu（Board & Maintenance 共通）

各Repoカード右上の三点リーダーは小さな一時的アクション群を開く"Overflow menu"（[Material Design](https://m3.material.io/components/menus/guidelines)）

#### メニュー項目（共通）

```
Open on GitHub
Open Production URL
Open Tracking dashboard
Open Supabase dashboard
Edit Project Info…   // モーダル起動
Move to Maintenance  // Boardのみ表示
Restore to Board     // Maintenanceのみ表示
```

### 4.2 Shortcuts（統一）

- `.` … フォーカス中カードの Overflow menu
- `Enter` … 既定アクション（Board=Open card、Maintenance=Open on GitHub）
- `⌘K` … Command Palette
- `Z` … Undo last move（1手）
- `?` … Shortcuts help

---

## 5) UI仕様（テキスト・ワイヤーフレーム）

**重要** UIは全て以下のワイヤーフレームから[Magic MCP](https://github.com/21st-dev/magic-mcp)で生成する

### 5.1 Sidebar（全画面共通）

```
┌───────────────────────────────┐
│ GitBox                         │
│ ───────────────────────────── │
│ Boards                         │
│  • All Boards                  │
│  • Favorites                   │
│ ───────────────────────────── │
│ Maintenance Mode               │  ← completed / maintenance projects
│ ───────────────────────────── │
│ Settings                       │
│ Shortcuts                      │
│ Profile & Sign out             │
└───────────────────────────────┘
```

### 5.2 Board（Kanban with overflow menus）

```
┌──────────────────────────────────────────────────────────────────────┐
│ AI Experiments                                 ○ avatar   [?]       │
│ [ Add Repositories ] [ Filter ] [ Compact ] [ Refresh ] [ ⌘K ]     │
│                                                                      │
│ Suspend           Spec designing      Active             Completed    │
│ (WIP 3/4)         (WIP –)             (WIP 5/6)          (WIP –)      │
│ ┌───────────────────────────┐   ┌───────────────────────────┐         │
│ │ repo-ml-lab        [⋯]    │   │ ui-research        [⋯]    │         │
│ │ "On hold this week"       │   │ "Draft spec"              │         │
│ └───────────────────────────┘   └───────────────────────────┘         │
│ ↑ drag to reorder (priority)     ← drag across lists to change status │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.3 Project Info（Modal - 強化版）

```
┌───────────────────────────────────────────────────┐
│ Project Info – laststance/app-studio              │
│---------------------------------------------------│
│ Quick note                                        │
│ [ "Heads down on auth rollout…" ]                 │
│---------------------------------------------------│
│ Links                                             │
│ • Production URL(s):  https://app.example.com     │
│ • Tracking:           https://plausible.io/...    │
│ • Supabase:           https://supabase.com/...    │
│---------------------------------------------------│
│ Credentials                                       │
│                                                   │
│ 📎 Supabase API Key                              │
│    Type: Reference                               │
│    [Open Dashboard →]                            │
│                                                   │
│ 🔒 GitHub OAuth Secret                           │
│    Type: Encrypted (Stored securely)             │
│    Value: github_*****xyz789                     │
│    Created: 2025-01-15                          │
│    [Copy] [Reveal] ← Requires 2FA               │
│                                                   │
│ 🔑 Database Password                             │
│    Type: External (1Password)                    │
│    Location: Team Vault > Production             │
│    [Open 1Password →]                           │
│---------------------------------------------------│
│ [ Save ] [ Cancel ]                               │
└───────────────────────────────────────────────────┘
```

### 5.4 Maintenance Mode（Explorer UI）

#### Grid View

```
┌───────────────────────────────────────────────────────────────┐
│ Maintenance Mode                              ○ avatar  [?]  │
│ [ Search archived... ] [ Grid ▾ ] [ Sort: Updated ▾ ]        │
│                                                               │
│ ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│ │ lib-utils  ⋯  │  │ ui-research ⋯ │  │ core-cli   ⋯  │  ...  │
│ │ "Shipped…"    │  │ "Docs only"   │  │ "Security"   │       │
│ │ Updated 2025-10-11  ⭐410         │  │ Updated 2025-07-01    │
│ └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                               │
│ [Open on GitHub]  [Restore to Board]  [Hide]                  │
└───────────────────────────────────────────────────────────────┘
```

#### List View（同画面で切替）

```
Name              Note                 Updated        Stars   Actions
lib-utils         "Shipped…"           2025-10-11     410     [⋯]
ui-research       "Docs only"          2025-09-03     128     [⋯]
core-cli          "Security"           2025-07-01      87     [⋯]
```

### 5.5 Settings

```
┌───────────────────────────────────────────────┐
│ Settings                                      │
│ Theme (12)                                    │
│  Light: Sunrise / Sandstone / Mint / Sky / ...│
│  Dark : Midnight / Graphite / Forest / ...    │
│  [ Preview ] [ Apply ]                        │
│-----------------------------------------------│
│ Typography                                    │
│  Base size: [16px ▾]  Step: [1px]            │
│  Scale preview: 12 13 14 15 16 18 20 22 24 28 │
│  (target: AA contrast on each theme)          │
└───────────────────────────────────────────────┘
```

---

## 6) データモデル（セキュリティ強化版）

```javascript
Board {
  id, name, lists[StatusList], theme, settings{wipLimits, compact}
}

StatusList {
  id, name, color, wipLimit, order
}

RepoCard {
  id, repoOwner, repoName, note, statusId, order,
  meta{stars, updatedAt, visibility, language, topics[]}
}

ProjectInfo {
  repoId,
  links{production[], tracking[], supabase[]},
  credentials: [
    {
      id: string,
      type: "reference" | "encrypted" | "external",
      name: string,

      // type: "reference"の場合
      reference?: string, // URLやダッシュボードへのリンク

      // type: "encrypted"の場合
      encrypted_value?: string, // AES-256-GCM暗号化された値
      encryption_key_id?: string, // KMS key reference
      created_at?: timestamp,
      last_accessed?: timestamp,
      masked_display?: string, // 例: "sk_live_****1234"

      // type: "external"の場合
      location?: string, // 外部管理ツールでの場所

      note?: string // 任意のメモ
    }
  ]
}

Maintenance {
  repoId, hidden?: boolean
}

AuditLog {
  id, userId, action, resourceId, resourceType,
  timestamp, ipAddress, userAgent, success: boolean
}
```

---

## 7) 品質保証

### 7.1 Accessibility & Visual Tests（自動検証）

- 12テーマ × 代表画面（Board/Maintenance/Modal）で**コントラスト測定**
- 基準：小テキスト4.5:1、UI 3:1
- **未達はビルド失敗**にする（axeルールにも合致）
- 参照：[Deque University](https://dequeuniversity.com/rules/axe/4.8/color-contrast)

### 7.2 パフォーマンス要件

- 100+ repositories でも候補表示が遅延しない
- D&D/Undo操作がストレスなく機能
- Grid/List切替がワンクリックで即座に反映

### 7.3 セキュリティテスト

- 暗号化/復号プロセスの自動テスト
- 監査ログの完全性確認
- 鍵ローテーションの動作確認

---

## 8) 受け入れ基準（統合版）

### 全体共通

- **Overflow menu**が**Board/Maintenance**双方のカードで**同一構造**・同一ショートカット（例：`.`で開く）を持つ
- すべてのRepoカードの右上⋯から同一モーダルを開ける（Board/Maintenance共通）

### Maintenance Mode

- **Grid/List**をワンクリックで切替
- **Enter=Open on GitHub**の既定アクション
- Explorer型UIは**リスト/テーブル**操作のHIGに沿って選択/並び替え/削除/復元を提供

### アクセシビリティ

- 12テーマ全てで、本文テキストの**4.5:1**、UI要素の**3:1**以上を満たす（自動テスト含む）

### セキュリティ（強化版）

- 3つの機密情報管理パターンが正しく機能する
- 一度きりのシークレットを**AES-256-GCM**で安全に暗号化して保存できる
- 暗号化された値の復号には**2FA認証**が必要
- すべての機密情報アクセスが**監査ログ**に記録される
- 3つの管理パターン（参照/暗号化/外部）をUIで明確に区別表示
- マスク表示がデフォルトで、必要時のみ値を表示（30秒で自動マスク）

---

## 9) 実装フェーズ

### Phase 1: 基本機能（MVP）

- Board/Kanbanの基本機能
- GitHub OAuth & Repository追加
- 参照リンク型のCredentials管理

### Phase 2: セキュリティ強化

- 暗号化保存型のCredentials実装
- 監査ログシステム

### Phase 3: 完全版

- 外部管理型（1Password/Bitwarden連携）
- Maintenance Mode完全実装
- 12テーマ対応

---

## 10) Drag & Drop Specification

### 10.1 技術的制約

#### @dnd-kit isTrusted 要件

@dnd-kitはセキュリティ上の理由から`event.isTrusted === true`のイベントのみを受け付ける。

| イベントソース           | isTrusted | D&D動作 |
| ------------------------ | --------- | ------- |
| 実際のユーザー操作       | ✅ true   | ✅ 動作 |
| Playwright CDP           | ✅ true   | ✅ 動作 |
| Playwright mouse API     | ❌ false  | ❌ 無視 |
| JavaScript dispatchEvent | ❌ false  | ❌ 無視 |
| Claude Chrome MCP        | ❌ false  | ❌ 無視 |

**E2Eテスト**: Playwright CDPヘルパー (`e2e/helpers/cdp-drag.ts`) を使用必須

### 10.2 Card Drag & Drop

#### 10.2.1 同一カラム内カード内並び替え

```
┌──────────────┐         ┌──────────────┐
│ In Progress  │         │ In Progress  │
│┌────────────┐│  drag   │┌────────────┐│
││ Card A     ││ ───┐    ││ Card B     ││
│├────────────┤│    │    │├────────────┤│
││ Card B     ││ <──┘    ││ Card A     ││ ← 入れ替え
│├────────────┤│         │├────────────┤│
││ Card C     ││         ││ Card C     ││
│└────────────┘│         │└────────────┘│
└──────────────┘         └──────────────┘
```

| 項目          | 値                            |
| ------------- | ----------------------------- |
| 実装状態      | ✅ 実装済み                   |
| E2Eカバー     | ⬜ 未カバー                   |
| Server Action | `batchUpdateRepoCardOrders()` |
| CDP Helper    | `cdpCardDragAndDrop()`        |

#### 10.2.2 カラム間移動

```
┌──────────────┐  ┌──────────────┐         ┌──────────────┐  ┌──────────────┐
│ In Progress  │  │ Review       │         │ In Progress  │  │ Review       │
│┌────────────┐│  │              │  drag   │              │  │┌────────────┐│
││ Card A     ││ ─┼──────────────┼───►     │              │  ││ Card A     ││
│└────────────┘│  │              │         │              │  │└────────────┘│
└──────────────┘  └──────────────┘         └──────────────┘  └──────────────┘
```

| 項目          | 値                                                      |
| ------------- | ------------------------------------------------------- |
| 実装状態      | ✅ 実装済み                                             |
| E2Eカバー     | ✅ カバー済み（`should move card to different column`） |
| Server Action | `updateRepoCardPosition()`                              |
| CDP Helper    | `cdpCardToColumnDragAndDrop()`                          |

### 10.3 Column Drag & Drop

#### 10.3.1 カラムSwap（位置入れ替え）

```
Row 0: [ A ] [ B ] [ C ]    →    Row 0: [ B ] [ A ] [ C ]
         ↓___↑                           (A と B が入れ替え)
        drag A → B
```

| 項目          | 値                                                  |
| ------------- | --------------------------------------------------- |
| 実装状態      | ✅ 実装済み                                         |
| E2Eカバー     | ✅ カバー済み（グリッド位置検証、ドラッグ操作実行） |
| Server Action | `swapStatusListPositions()`                         |
| CDP Helper    | `cdpColumnDragAndDrop()`                            |
| 注意          | DropZoneがシビア - ターゲットの中心を超える必要あり |

#### 10.3.2 NewRowDropZone（新Row作成）

```
Row 0: [ A ] [ B ] [ C ] [ D ]
                    ↓ drag down
         ┌─────────────────────────────┐
         │ Drop column to create row   │  ← NewRowDropZone
         └─────────────────────────────┘
                    ↓
Row 0: [ A ] [ B ] [ D ]
Row 1: [ C ]                           ← 新Row作成
```

| 項目          | 値                               |
| ------------- | -------------------------------- |
| 実装状態      | ✅ 実装済み                      |
| E2Eカバー     | ⬜ 検証強化必要                  |
| Server Action | `updateStatusListPosition()`     |
| CDP Helper    | `cdpColumnToNewRowDragAndDrop()` |

#### 10.3.3 ColumnInsertZone（空スロット挿入）

```
Row 0: [ A ] [   ] [ B ] [ C ]
               ↑
         drag A → empty slot
               ↓
Row 0: [   ] [ A ] [ B ] [ C ]    (後続カラムは右シフト)
```

| 項目          | 値                                 |
| ------------- | ---------------------------------- |
| 実装状態      | ✅ 実装済み                        |
| E2Eカバー     | ⬜ 未カバー                        |
| Server Action | `batchUpdateStatusListPositions()` |
| CDP Helper    | `cdpColumnToGridPosition()`        |

#### 10.3.4 同一Row内横移動

ColumnInsertZone または Column Swap で実現

### 10.4 未実装機能

#### 10.4.1 カラムAuto-Height（高さ自動拡張）

**問題**: カラムに多数のカードがある場合、heightが固定で一部のカードしか表示されない

```
現状:                          期待される挙動:
┌──────────────┐              ┌──────────────┐
│ In Progress  │              │ In Progress  │
│    10/3      │              │    10/3      │
│┌────────────┐│              │┌────────────┐│
││ Card 1     ││              ││ Card 1     ││
│└────────────┘│              │├────────────┤│
│ (9個が隠れ)  │              ││ Card 2     ││
│              │              │├────────────┤│
└──────────────┘              ││ ...        ││
                              │├────────────┤│
                              ││ Card 10    ││
                              │└────────────┘│
                              └──────────────┘
                                 ↑ Height拡張
```

| 項目         | 値                                       |
| ------------ | ---------------------------------------- |
| 実装状態     | ❌ 未実装                                |
| E2Eカバー    | ❌ 未カバー                              |
| 影響ファイル | `SortableColumn.tsx`, `StatusColumn.tsx` |
| 設計検討     | CSS Grid `grid-auto-rows` vs JS計算      |

### 10.5 E2Eテストカバレッジ要件

| テスト名                     | ステータス                                                         |
| ---------------------------- | ------------------------------------------------------------------ |
| Card: カラム表示確認         | ✅ 追加済み（`should display cards in columns`）                   |
| Card: カラム間移動           | ✅ 追加済み（`should move card to different column`）              |
| Card: 同一カラム内並び替え   | ⬜ 追加必要                                                        |
| Card: statusId更新確認       | ✅ 上記テストで検証                                                |
| Column: グリッド位置検証     | ✅ 追加済み（`should have correct initial column grid positions`） |
| Column: Swap操作実行         | ✅ 追加済み（`should execute column drag operation successfully`） |
| Column: NewRowDropZone       | ⬜ 検証強化必要                                                    |
| Column: ColumnInsertZone挿入 | ⬜ 追加必要                                                        |
| Column: Auto-Height拡張      | ⬜ 実装後追加                                                      |

### 10.6 CDP Drag Helper一覧

```typescript
// e2e/helpers/cdp-drag.ts
export async function cdpDragAndDrop(page, source, target, options?)
export async function cdpColumnDragAndDrop(page, sourceId, targetId, options?)
export async function cdpCardDragAndDrop(page, sourceId, targetId, options?)
export async function cdpCardToColumnDragAndDrop(
  page,
  cardId,
  columnId,
  options?,
)
export async function cdpColumnToNewRowDragAndDrop(
  page,
  columnId,
  row,
  options?,
)
export async function cdpColumnToGridPosition(
  page,
  columnId,
  row,
  col,
  options?,
)
```

---

## 参照リンク集

- [Harmonizer - Evil Martians](https://harmonizer.evilmartians.com/)
- [W3C WCAG 2.1](https://www.w3.org/TR/WCAG21/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Material Design 3 - Menus](https://m3.material.io/components/menus/guidelines)
- [Apple HIG - Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
- [GitHub Docs - Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/)
- [Supabase Docs](https://supabase.com/docs/)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Deque University - Color Contrast](https://dequeuniversity.com/rules/axe/4.8/color-contrast)
