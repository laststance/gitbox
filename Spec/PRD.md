# GitBox — PRD v0.5 (2026-01-07 Update)

## 1) プロダクト概要と情報設計（IA）

- 対応言語
  - 英語
- トップページはログイン、サインインボタンを配置したLandingPage

### ナビゲーションフロー

**Auth\*(Github OAuth)** → **Home (Boards)** → **Board (Kanban)** → **Card Detail (right panel)**

### 主要画面

- **Maintenance Mode**（完了・保守中のプロジェクト保管庫。Sidebarリンクで遷移、Explorer UI）
- **Command Palette (⌘K)**
- **Settings**（Theme/Display/Typography）
- **Shortcuts (?)**
- **Account**（プロフィール、統計、アカウント削除）

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

### 2.2 Design Tokens（14 Themes）

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

- **Light:** Light /Sunrise / Sandstone / Mint / Sky / Lavender / Rose
- **Dark:** Dark / Midnight / Graphite / Forest / Ocean / Plum / Rust

---

## 3) 機能要件

### 3.1 GitHub OAuth & Repository追加

#### 機能仕様

- Combobox検索（owner/repo, topics, visibility）
- 複数一括追加/重複検知
- **Organization Filter**: ユーザー/Org単位でリポジトリをフィルタリング（設定永続化）
- **First Board自動作成**: 新規ユーザー初回ログイン時に"My First Board"を自動作成

#### 受け入れ基準

- 100+ repos でも候補表示が遅延しない
- D&D/Undoがストレスなく機能
- Organization選択がセッション間で維持される

### 3.2 Board（Kanban）

#### 機能仕様

- **列=Status**（例：Suspend / Spec designing / Active / Completed）
- 列CRUD操作（2Dグリッド配置対応: gridRow, gridCol）
- **カード**：repo名、一言メモ、任意メタ（Stars/Updated/Visibility/Language/Topics等）
- **⋯（Overflow menu）**：**Project Info**モーダル起動
- **Favorites**: ボードをお気に入りに追加（星マーク、サイドバーに優先表示）
- **Board Settings**: ボード名変更、カード表示設定（テーマはアプリ全体で管理）

#### 受け入れ基準

- Board=Statusフィールド基準
- D&D操作の定石に準拠（[GitHub Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/)）
- Favorites切り替えが即座に反映

### 3.3 Maintenance Mode

#### 機能仕様

- Sidebarから遷移
- **Explorer UI**（Grid/List切替、並び替え/検索）
- **クリック＝GitHub repo へ遷移**
- カード右上に**⋯メニュー**
- **復帰（Restore to Board）**や**Hide**操作を提供

#### UI根拠

リスト/テーブル/サイドバーUIのHIG（[Apple Developer](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)）

### 3.4 Project Note（リッチテキストノート）

各RepoカードのNoteボタンから起動可能な、フル機能のWYSIWYGエディタ（以下「Project Note」または「NoteModal」）

#### 機能仕様

- **Plate Editor**ベースのリッチテキストエディタ
- **Fixed Toolbar**: 常時表示のフォーマットツールバー（Bold, Italic, Headings, Lists等）
- **Floating Toolbar**: テキスト選択時に表示されるコンテキストツールバー
- **Slash Commands**: `/`入力でコマンドメニュー表示（/h1, /code, /table等）
- **Markdown Autoformat**: `# `→H1, `* `→箇条書き, `1. `→番号付きリスト, `> `→引用
- **文字数カウント**: 最大20,000文字、リアルタイム表示
- **自動下書き保存**: 編集中は自動でドラフト保存（Redux + localStorage永続化）

#### 対応フォーマット

| カテゴリ   | 要素                                                           |
| ---------- | -------------------------------------------------------------- |
| **Block**  | Heading (H1-H3), Paragraph, Blockquote, Code Block, Table      |
| **List**   | Bullet List, Numbered List                                     |
| **Inline** | Bold, Italic, Underline, Strikethrough, Inline Code, Highlight |
| **Media**  | Link (URL埋め込み)                                             |

#### データ形式

- **保存形式**: JSON（Slate format）
- **レガシー対応**: プレーンテキストからの自動マイグレーション
- **文字数計算**: JSONからテキストを抽出してカウント

#### 受け入れ基準

- キーボードショートカット動作（Cmd+B=Bold, Cmd+I=Italic）
- Slash commandsでブロック挿入
- Markdown autoformatが正しく変換
- 保存後に再オープンでフォーマット保持
- ページリフレッシュ後もデータ永続

### 3.5 Project Info（モーダル）

すべてのRepoカードから起動可能

#### Sections

1. **Comment**（インラインコメント、最大2,000文字。RepoCard上に表示される簡易メモ。詳細は3.6参照）

2. **Links**（55種類の組み込みリンクタイプ + カスタムプリセット）
   - **Built-in Types**: 12カテゴリに分類された55種類のリンクタイプ
     - Development (GitHub, GitLab, Bitbucket, etc.)
     - Deployment (Vercel, Netlify, AWS, etc.)
     - Database (Supabase, MongoDB, Firebase, etc.)
     - Monitoring (Sentry, DataDog, etc.)
     - Documentation (Notion, Confluence, etc.)
     - Analytics (Google Analytics, Mixpanel, etc.)
     - Communication (Slack, Discord, etc.)
     - その他
   - **Custom Presets**: ユーザー定義のリンクタイプ（Lucide iconから選択）
   - **EditableUrlItem UI**: インライン編集コンポーネント
     - **Single-Edit Coordination**: 1つのURLのみ同時編集可能（他は自動保存）
     - **URL Validation**: 最大2083文字、http/https プロトコルのみ許可
     - **Debounced Validation**: 300ms遅延で入力検証
     - **Delete with Undo**: 削除後5秒間Undo可能（Sonner toast）
     - **Blur Handler**: Combobox/Dropdownクリック時の誤保存防止

3. **Note**（リッチテキスト、最大20,000文字。Plate Editorで編集）

### 3.6 Comment on RepoCard（インラインコメント）

RepoカードにフリーテキストのステータスコメントをCard-in-Cardスタイルで表示

#### 機能仕様

- **インライン表示**: RepoCard上に直接コメントを表示（モーダル不要）
- **Card-in-Card UI**: 左ボーダーアクセント + 背景色で視覚的に区別
- **フルテキスト表示**: Truncateなし、コンテンツ量に応じてカード高さが拡張
- **インライン編集**: クリックで直接編集、2,000文字制限
- **カラーカスタマイズ**: 8色から選択可能（primary/red/orange/yellow/green/blue/purple/pink）

#### UIワイヤーフレーム

```
┌─────────────────────────────────────────┐
│ laststance/redux-vanilla            ⋯  │
│                                         │
│ [Unmaintained] 🍵 Zero Abstraction...  │  ← GitHub desc (optional)
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 💬 npmリリース完了、当分は機能追加   │ │  ← Comment
│ │    予定なし                         │ │     Card-in-Card
│ │                            ✏️       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📄 Note                                 │
└─────────────────────────────────────────┘
```

#### Board Settings

```typescript
interface BoardSettings {
  cardDisplay?: {
    showGitHubDescription: boolean // default: true
    showComment: boolean // default: true
    commentStyle: {
      fontSize: 'sm' | 'base' | 'lg' // default: 'sm'
      bold: boolean // default: false
      borderColor: string // default: 'primary'
      backgroundColor: string // default: 'muted/30'
    }
  }
}
```

#### データモデル

| Column                      | Type | Limit       | Description        |
| --------------------------- | ---- | ----------- | ------------------ |
| `projectinfo.comment`       | TEXT | 2,000 chars | インラインコメント |
| `projectinfo.comment_color` | TEXT | -           | 8色から選択        |

#### 受け入れ基準

- コメントがRepoCard上に表示される
- 全文表示（truncateなし）
- Board Settingsで表示/非表示切り替え可能
- インライン編集で即時保存
- 空の場合は「+ Add comment」プレースホルダー表示

### 3.7 Sidebar Collapse（サイドバー折りたたみ）

#### 機能仕様

- **Toggle Button**: サイドバー下部のボタンで展開/折りたたみを切り替え
- **Expanded State**: 幅256px（w-64）、フルテキスト表示
- **Collapsed State**: 幅64px（w-16）、アイコンのみ表示
- **Transition Animation**: 300ms ease-out でスムーズな幅変化
- **Tooltips**: 折りたたみ時、各ナビゲーション項目にホバーでTooltip表示（side="right"）
- **State Persistence**: Redux Storage Middleware経由でlocalStorageに永続化

#### 技術仕様

- **useSidebar Hook**: hydration safetyのためmounted state管理
- **CSS**: `transition-[width] duration-300 ease-out`
- **Responsive**: デスクトップ専用（モバイルは別レイアウト）

#### 受け入れ基準

- トグルボタンクリックで即座に状態変化
- アニメーションがスムーズ（60fps）
- 折りたたみ時もすべてのナビゲーションが機能
- ページリロード後も状態が維持
- 折りたたみ時のTooltipが正しく表示

### 3.8 Account（アカウント管理）

#### 機能仕様

- **プロフィール表示**: GitHub avatar、ユーザー名、メールアドレス
- **統計表示**: ボード数、カード数、Maintenance数
- **アカウント削除**: "DELETE"入力による確認フローでアカウントを完全削除

#### 受け入れ基準

- プロフィール情報がGitHub認証から正しく取得される
- アカウント削除時に関連する全データが削除される
- 削除確認は"DELETE"の完全一致を要求

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
- `⌘K` / `Ctrl+K` … Command Palette
- `Z` … Undo last D&D move（最大10手履歴、Redux管理）
- `Tab` … フォーカス移動
- `Escape` … メニュー/ダイアログを閉じる
- `?` … Shortcuts help

---

## 5) UI仕様（テキスト・ワイヤーフレーム）

**重要** UIは全て以下のワイヤーフレームから[Magic MCP](https://github.com/21st-dev/magic-mcp)で生成する

### 5.1 Sidebar（全画面共通・折りたたみ対応）

#### Expanded State（展開時: 256px / w-64）

```
┌───────────────────────────────┐
│ GitBox                         │
│ ───────────────────────────── │
│ Boards                    [▼]  │  ← 折りたたみ可能
│  • All Boards                  │
│  • Favorites                   │
│  • New Board (+)               │
│ ───────────────────────────── │
│ Maintenance Mode               │  ← completed / maintenance projects
│ ───────────────────────────── │
│ Settings                       │
│ Shortcuts                      │
│ Theme: [Sunrise ▾]             │  ← グローバルテーマ選択（14テーマ + System）
│ ───────────────────────────── │
│ Account                        │  ← プロフィール、統計、削除
│ Sign out                       │
│ ───────────────────────────── │
│ [« Collapse]                   │  ← 折りたたみトグルボタン
└───────────────────────────────┘
```

#### Collapsed State（折りたたみ時: 64px / w-16）

```
┌────────┐
│ [Logo] │
│ ────── │
│  [📋]  │  ← Boards（Tooltip: "Boards"）
│  [⭐]  │  ← Favorites（Tooltip: "Favorites"）
│  [+]   │  ← New Board（Tooltip: "New Board"）
│ ────── │
│  [📦]  │  ← Maintenance（Tooltip: "Maintenance Mode"）
│ ────── │
│  [⚙️]  │  ← Settings（Tooltip: "Settings"）
│  [⌨️]  │  ← Shortcuts（Tooltip: "Shortcuts"）
│  [🎨]  │  ← Theme（Tooltip: "Theme"）
│ ────── │
│  [👤]  │  ← Account（Tooltip: "Account"）
│  [🚪]  │  ← Sign out（Tooltip: "Sign out"）
│ ────── │
│  [»]   │  ← 展開トグルボタン
└────────┘
```

#### 仕様詳細

| 項目         | 展開時           | 折りたたみ時       |
| ------------ | ---------------- | ------------------ |
| 幅           | 256px (w-64)     | 64px (w-16)        |
| テキスト     | フル表示         | 非表示             |
| アイコン     | テキスト左に配置 | 中央配置           |
| Tooltip      | なし             | ホバー時に右側表示 |
| トグルボタン | 「« Collapse」   | 「»」アイコン      |

#### アニメーション

- **Transition**: `transition-[width] duration-300 ease-out`
- **Content**: テキストはopacityフェードで切り替え
- **Icons**: 位置のスムーズな移動

### 5.2 Board（Kanban with overflow menus）

```
┌──────────────────────────────────────────────────────────────────────┐
│ AI Experiments                                 ○ avatar   [?]       │
│ [ Add Repositories ] [ Filter ] [ Compact ] [ Refresh ] [ ⌘K ]     │
│                                                                      │
│ Pending           Planning            Focus Development  Production Release │
│ ┌───────────────────────────┐   ┌───────────────────────────┐         │
│ │ repo-ml-lab        [⋯]    │   │ ui-research        [⋯]    │         │
│ │ "On hold this week"       │   │ "Draft spec"              │         │
│ └───────────────────────────┘   └───────────────────────────┘         │
│ ↑ drag to reorder (priority)     ← drag across lists to change status │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.3 Project Info（Modal）

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
│-----------------------------------------------│
│ Theme (14 + System)                           │
│  ○ System (OS preference)                     │
│  Light: default / Sunrise / Sandstone / Mint /│
│         Sky / Lavender / Rose                 │
│  Dark : dark / Midnight / Graphite / Forest / │
│         Ocean / Plum / Rust                   │
│-----------------------------------------------│
│ Display                                       │
│  ☑ Compact Mode                               │
│  ☑ Show Card Metadata (stars, language, date) │
│-----------------------------------------------│
│ Typography                                    │
│  Base size: [16px] (12-20px range)            │
└───────────────────────────────────────────────┘
```

**Theme**:

- **アクセス方法**: Settings画面またはSidebarのThemeドロップダウンから変更可能
- **スコープ**: アプリ全体に適用（ボード固有設定はなし）
- **14テーマ + System**: Light 7種 + Dark 7種 + OS設定追従

**Display Settings**:

- **Compact Mode**: カード/列の余白を縮小して情報密度を向上
- **Show Card Metadata**: スター数、言語、更新日時の表示/非表示

**永続化**: Redux + localStorage (`redux-storage-middleware`)

### 5.6 NoteModal（リッチテキストエディタ）

````
┌───────────────────────────────────────────────────────────┐
│ Project Note                                          [×] │
│ Add notes about owner/repo-name. Use toolbar for         │
│ formatting.                                               │
│-----------------------------------------------------------│
│ ┌───────────────────────────────────────────────────────┐ │
│ │ [B] [I] [U] [S] [~] [<>] | [H▾] | [•] [1.] | [🔗] [📊] │ │ ← Fixed Toolbar
│ └───────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │                                                       │ │
│ │  # Project Overview                                   │ │ ← H1 Heading
│ │                                                       │ │
│ │  This project uses **React** and _TypeScript_.        │ │ ← Bold, Italic
│ │                                                       │ │
│ │  ## Key Features                                      │ │ ← H2 Heading
│ │  • Authentication system                              │ │ ← Bullet List
│ │  • Dashboard with analytics                           │ │
│ │  • API integration                                    │ │
│ │                                                       │ │
│ │  ```typescript                                        │ │ ← Code Block
│ │  const config = { theme: 'dark' }                     │ │
│ │  ```                                                  │ │
│ │                                                       │ │
│ │  > Note: Deploy to production after testing.          │ │ ← Blockquote
│ │                                                       │ │
│ │  | Header 1 | Header 2 | Header 3 |                   │ │ ← Table
│ │  |----------|----------|----------|                   │ │
│ │  | Cell 1   | Cell 2   | Cell 3   |                   │ │
│ │                                                       │ │
│ │  Type / for commands...                               │ │ ← Placeholder
│ │                                                       │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│                                    1,234 / 20,000         │ ← Character Count
│                                    Draft saved 10:30 AM   │ ← Auto-save Status
│                                                           │
│                              [ Cancel ]  [ Save ]         │
└───────────────────────────────────────────────────────────┘

Slash Command Menu (on "/" input):
┌─────────────────────┐
│ /h1  Heading 1      │
│ /h2  Heading 2      │
│ /h3  Heading 3      │
│ /code  Code Block   │
│ /table  Table       │
│ /quote  Blockquote  │
│ /list  Bullet List  │
│ /num  Numbered List │
└─────────────────────┘

Floating Toolbar (on text selection):
┌─────────────────────────────────────┐
│ [B] [I] [U] [S] [<>] [🔗] | [H▾]    │
└─────────────────────────────────────┘
````

#### Toolbar Buttons

| アイコン | 機能            | ショートカット |
| -------- | --------------- | -------------- |
| **B**    | Bold            | Cmd+B          |
| _I_      | Italic          | Cmd+I          |
| <u>U</u> | Underline       | Cmd+U          |
| ~~S~~    | Strikethrough   | -              |
| `<>`     | Inline Code     | -              |
| 🖌️       | Highlight       | -              |
| H▾       | Heading (H1-H3) | -              |
| •        | Bullet List     | -              |
| 1.       | Numbered List   | -              |
| 🔗       | Link            | Cmd+K          |
| 📊       | Table           | -              |

---

## 6) データモデル

### 6.1 Database Tables (Supabase)

```sql
-- Board: Kanban Board
Board {
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  name text NOT NULL,
  description text,
  is_favorite boolean DEFAULT false,  -- お気に入りボード
  created_at, updated_at
}

-- StatusList: Kanban Column (Grid配置対応)
StatusList {
  id uuid PRIMARY KEY,
  board_id uuid REFERENCES Board,
  name text NOT NULL,
  color text,
  order integer,
  grid_row integer DEFAULT 0,  -- 2Dグリッド行位置
  grid_col integer DEFAULT 0,  -- 2Dグリッド列位置
  created_at, updated_at
}

-- RepoCard: GitHub Repository Card
RepoCard {
  id uuid PRIMARY KEY,
  board_id uuid REFERENCES Board,
  status_list_id uuid REFERENCES StatusList,
  repo_name text NOT NULL,
  repo_owner text NOT NULL,
  order integer,
  created_at, updated_at
  -- note は ProjectInfo に移動済み
}

-- ProjectInfo: Extended Project Details
ProjectInfo {
  id uuid PRIMARY KEY,
  repo_card_id uuid REFERENCES RepoCard,
  maintenance_id uuid REFERENCES Maintenance,  -- Maintenance連携
  links jsonb,  -- {type, url, icon}[] - 55種類の組み込みタイプ
  note text,  -- リッチテキスト（Plate Editor, max 20,000文字）
  comment text,  -- インラインコメント（max 2,000文字）
  comment_color text DEFAULT 'primary',  -- 8色: primary/red/orange/yellow/green/blue/purple/pink
  created_at, updated_at
}

-- UserLinkPresets: User-defined Link Types
UserLinkPresets {
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  name text NOT NULL,
  icon text NOT NULL,  -- Lucide icon name
  created_at, updated_at
}

-- Maintenance: Archived Repositories
Maintenance {
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  created_at, updated_at
  -- note, hidden, repo_card_id は削除済み
}
```

### 6.2 Frontend State (Redux + localStorage)

```typescript
// Settings Slice (永続化: localStorage)
Settings {
  theme: ThemeName,              // 14テーマ + system（グローバル設定）
  typography: { baseSize, scale },
  compactMode: boolean,
  showCardMetadata: boolean,
  organizationFilter: string,    // AddRepositoryCombobox のフィルター
  sidebarCollapsed: boolean,     // Sidebar折りたたみ状態（デフォルト: false）
}

// Board Slice (セッション)
Board {
  activeBoard: Board | null,
  statusLists: StatusListDomain[],
  repoCards: RepoCardForRedux[],
  loading: boolean,
  error: string | null,
  lastDragOperation: DragOperation | null,  // Undo用
  undoHistory: DragOperation[],             // 最大10件
}

// Draft Slice (永続化: localStorage)
Draft {
  [repoCardId]: { note: JSON, comment: string },  // 自動保存
}

// Auth Slice (セッション)
Auth {
  isAuthenticated: boolean,
}
```

### 6.3 RepoCard Meta (GitHub API)

```typescript
// GitHub APIから取得、DB非保存
RepoCardMeta {
  stars: number,
  updatedAt: string,
  visibility: 'public' | 'private',
  language: string | null,
  topics: string[],
}
```

---

## 7) 品質保証

### 7.1 Accessibility & Visual Tests（自動検証）

- 14テーマ × 代表画面（Board/Maintenance/Modal）で**コントラスト測定**
- 基準：小テキスト4.5:1、UI 3:1
- **未達はビルド失敗**にする（axeルールにも合致）
- 参照：[Deque University](https://dequeuniversity.com/rules/axe/4.8/color-contrast)

### 7.2 パフォーマンス要件

- 100+ repositories でも候補表示が遅延しない
- D&D/Undo操作がストレスなく機能
- Grid/List切替がワンクリックで即座に反映

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

- 14テーマ全てで、本文テキストの**4.5:1**、UI要素の**3:1**以上を満たす（自動テスト含む）

---

## 9) 実装フェーズ

### Phase 1: 基本機能（MVP）

- Board/Kanbanの基本機能
- GitHub OAuth & Repository追加
- Project Info（Notes、Links）

### Phase 2: 完全版

- Maintenance Mode完全実装
- 14テーマ対応（Light 7 + Dark 7）
- Comment on RepoCard機能
- Account管理（プロフィール、統計、削除）
- Favorites機能

---

## 10) PWA & Meta 仕様

### 10.1 Open Graph / Twitter Card

ソーシャルメディア共有時のプレビュー画像とメタデータを提供。

| 項目             | ファイル                  | サイズ   |
| ---------------- | ------------------------- | -------- |
| OG Image         | `app/opengraph-image.tsx` | 1200×630 |
| Twitter Card     | `app/twitter-image.tsx`   | 1200×600 |
| Favicon          | `app/icon.svg`            | SVG      |
| Apple Touch Icon | `app/apple-icon.tsx`      | 180×180  |

#### メタデータ設定

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  title: 'GitBox - Organize Your GitHub Repositories',
  description: 'PWA for managing GitHub repositories in Kanban format',
  keywords: ['GitHub', 'Repository Manager', 'Kanban', 'PWA'],
  openGraph: { ... },
  twitter: { card: 'summary_large_image', ... },
}
```

### 10.2 PWA Manifest

`public/manifest.json` でPWAとしてインストール可能。

```json
{
  "name": "GitBox",
  "short_name": "GitBox",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
```

---

## 11) Drag & Drop Specification

### 11.1 技術的制約

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

### 11.2 Card Drag & Drop

#### 11.2.1 同一カラム内カード内並び替え

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

| 項目          | 値                                                         |
| ------------- | ---------------------------------------------------------- |
| 実装状態      | ✅ 実装済み                                                |
| E2Eカバー     | ✅ カバー済み（`should reorder cards within same column`） |
| Server Action | `batchUpdateRepoCardOrders()`                              |
| CDP Helper    | `cdpCardDragAndDrop()`                                     |

#### 11.2.2 カラム間移動

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

### 11.3 Column Drag & Drop

#### 11.3.1 カラムSwap（位置入れ替え）

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

#### 11.3.2 NewRowDropZone（新Row作成）

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
| E2Eカバー     | ✅ カバー済み                    |
| Server Action | `updateStatusListPosition()`     |
| CDP Helper    | `cdpColumnToNewRowDragAndDrop()` |

#### 11.3.3 ColumnInsertZone（空スロット挿入）

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
| E2Eカバー     | ✅ カバー済み                      |
| Server Action | `batchUpdateStatusListPositions()` |
| CDP Helper    | `cdpColumnToInsertZone()`          |

#### 11.3.4 同一Row内横移動

ColumnInsertZone または Column Swap で実現

#### 11.3.5 縦方向Column Swap（Row間位置入れ替え）

```
Row 0: [ A ] [   ] [   ]         Row 0: [ B ] [   ] [   ]
Row 1: [ B ] [   ] [   ]   →     Row 1: [ A ] [   ] [   ]
         ↓___↑                           (A と B が Row を入れ替え)
        drag A → B
```

**前提条件**: NewRowDropZone でカラムを Row 1 以降に移動した後、マルチRow構成になっている状態

| 項目          | 値                                 |
| ------------- | ---------------------------------- |
| 実装状態      | ✅ 実装済み                        |
| E2Eカバー     | ✅ カバー済み                      |
| Server Action | `swapStatusListPositions()`        |
| CDP Helper    | `cdpColumnDragAndDrop()`           |
| 注意          | 同一gridColのカラム間でRow位置交換 |

**挙動**:

1. カラムA（Row 0）をカラムB（Row 1, 同じgridCol）にドラッグ＆ドロップ
2. A と B の gridRow を完全交換
3. A が Row 1 へ移動、B が Row 0 へ移動

#### 11.3.6 斜め方向Column Swap（対角線位置入れ替え）

```
Row 0: [ A ] [   ] [   ]         Row 0: [   ] [   ] [ B ]
Row 1: [   ] [   ] [ B ]   →     Row 1: [ A ] [   ] [   ]
         ↘_________↗                     (A と B が斜めに入れ替え)
        drag A → B
```

**前提条件**: NewRowDropZone でカラムを Row 1 以降に移動した後、マルチRow構成になっている状態

| 項目          | 値                             |
| ------------- | ------------------------------ |
| 実装状態      | ✅ 実装済み                    |
| E2Eカバー     | ✅ カバー済み                  |
| Server Action | `swapStatusListPositions()`    |
| CDP Helper    | `cdpColumnDragAndDrop()`       |
| 注意          | gridRow, gridCol両方を完全交換 |

**挙動**:

1. カラムA（Row 0, Col 0）をカラムB（Row 1, Col 2）にドラッグ＆ドロップ
2. A と B の gridRow と gridCol を完全交換
3. A が (Row 1, Col 2) へ移動、B が (Row 0, Col 0) へ移動

**実装詳細**:

- `handleDragEnd` in `components/Board/KanbanBoard.tsx` (lines 460-501)
- Column Swap のロジックは gridRow と gridCol の両方を交換するため、横/縦/斜めの全方向でSwapが動作

### 11.4 未実装機能

#### 11.4.1 カラムAuto-Height（高さ自動拡張）

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

| 項目         | 値                                                                         |
| ------------ | -------------------------------------------------------------------------- |
| 実装状態     | ✅ 実装済み（2025-12-28）                                                  |
| E2Eカバー    | ✅ カバー済み（`e2e/kanban.spec.ts` - Column Auto-Height テスト）          |
| 影響ファイル | `KanbanBoard.tsx`, `SortableColumn.tsx`, `StatusColumn.tsx`, `cdp-drag.ts` |
| 実装方式     | CSS Grid `minmax(min-content, auto)` + height constraints 除去             |

**実装詳細**:

1. `KanbanBoard.tsx`: `gridTemplateRows` を `minmax(0, 1fr)` → `minmax(min-content, auto)` に変更
2. `KanbanBoard.tsx`: 外側コンテナ・グリッドから `h-full min-h-0` を除去
3. `SortableColumn.tsx`: `h-full min-h-0` と `overflow-hidden` を除去
4. `StatusColumn.tsx`: `h-full min-h-0` と `overflow-y-auto` を除去
5. `cdp-drag.ts`: グリッドセレクターを `.w-fit.min-w-full.p-6` に更新

### 11.5 E2Eテストカバレッジ要件

| テスト名                     | ステータス                                                         |
| ---------------------------- | ------------------------------------------------------------------ |
| Card: カラム表示確認         | ✅ 追加済み（`should display cards in columns`）                   |
| Card: カラム間移動           | ✅ 追加済み（`should move card to different column`）              |
| Card: 同一カラム内並び替え   | ✅ 追加済み（`should reorder cards within same column`）           |
| Card: statusId更新確認       | ✅ 上記テストで検証                                                |
| Column: グリッド位置検証     | ✅ 追加済み（`should have correct initial column grid positions`） |
| Column: Swap操作実行         | ✅ 追加済み（`should execute column drag operation successfully`） |
| Column: 縦方向Swap           | ✅ 追加済み（11.3.5 - 2テスト in `column-dnd.spec.ts`）            |
| Column: 斜め方向Swap         | ✅ 追加済み（11.3.6 - 3テスト in `column-dnd.spec.ts`）            |
| Column: NewRowDropZone       | ✅ 追加済み（6テストケース in `column-dnd.spec.ts`）               |
| Column: ColumnInsertZone挿入 | ✅ 追加済み（5テストケース in `column-dnd.spec.ts`）               |
| Column: Auto-Height拡張      | ✅ 追加済み（`e2e/kanban.spec.ts` - 6テスト）                      |

### 11.6 CDP Drag Helper一覧

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
export async function cdpColumnToInsertZone(page, columnId, row, col, options?)
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
- [Deque University - Color Contrast](https://dequeuniversity.com/rules/axe/4.8/color-contrast)
