# OSS Web App Versioning and GitHub Release Research

> Research Date: 2026-01-03
> Target: GitBox (Next.js + Vercel web app)

## Executive Summary

OSS web appのバージョン管理とGitHub Release作成について、Excalidraw、Plane、Cal.com、Outlineを調査した結果、以下の3つのアプローチが主流であることが判明しました：

1. **Manual + Auto-generated Release Notes** - 最もシンプル、小規模チーム向け
2. **Release Please** - Google製、PR経由の承認フロー、中規模プロジェクト推奨
3. **Changesets** - モノレポ向け、複数パッケージの連携リリース

**GitBoxへの推奨**: Phase 1でManual + `.github/release.yml`、Phase 2でRelease Please導入

---

## 調査対象プロジェクト

| Project        | Stars | Versioning           | Tool                 | Release Frequency    |
| -------------- | ----- | -------------------- | -------------------- | -------------------- |
| **Excalidraw** | 100k+ | SemVer               | Custom + npm publish | 継続的 (npm package) |
| **Plane**      | 40k+  | SemVer (v0.x → v1.x) | Manual + Auto-notes  | 月1-2回              |
| **Outline**    | 30k+  | SemVer (v1.0達成)    | Manual + Auto-notes  | 月1-2回              |
| **Cal.com**    | 35k+  | SemVer               | **Changesets**       | モノレポ複数         |

---

## 1. Excalidraw のアプローチ

### 特徴

- **npmパッケージ公開**が主目的（`@excalidraw/excalidraw`）
- Web appとパッケージで別々のchangelog管理
- Conventional Commitsを強制（PR title validation）

### ワークフロー構成

```yaml
# .github/workflows/autorelease-excalidraw.yml
on:
  push:
    branches: [release]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2 # バージョン比較用
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          registry-url: https://registry.npmjs.org
      - run: yarn release --tag next --non-interactive
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 学び

- Web appにはnpm publishは不要
- Conventional Commitsは有用だがEnforceは任意

---

## 2. Plane のアプローチ

### 特徴

- **手動リリース** + GitHub Auto-generated Release Notes
- v0.x系からv1.0.0への移行を達成
- Docker imageとセットでリリース

### リリースノートのカテゴリ化

```yaml
# .github/release.yml
changelog:
  categories:
    - title: '⚡ Enhancements'
      labels:
        - enhancement
    - title: '🐛 Bug Fixes'
      labels:
        - bug
    - title: '🔧 Chores'
      labels:
        - chore
```

### 学び

- GitBoxのような単一web appには十分
- Dockerリリースはseparate workflow

---

## 3. Cal.com のアプローチ (Changesets)

### 特徴

- **モノレポ構成**（apps/, packages/）
- Changesetsで各パッケージのバージョン管理
- Contributors経由でchangeset PR作成

### ワークフロー

```bash
# 1. 開発者がchangesetを追加
pnpm changeset
# → .changeset/random-name.md が作成される

# 2. CIがVersion PRを作成
pnpm changeset version

# 3. マージ後にpublish
pnpm changeset publish
```

### 学び

- GitBoxはモノレポではないため過剰
- 将来的にパッケージ分離するなら検討

---

## 4. Release Please のアプローチ

### 特徴

- Google製、Conventional Commits解析
- **Release PR**を自動作成・更新
- マージするとReleaseが作成される

### 基本ワークフロー

```yaml
# .github/workflows/release-please.yml
name: Release Please
on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          release-type: node
```

### Conventional Commits → バージョン

| Commit Prefix                 | Version Bump  | Example                         |
| ----------------------------- | ------------- | ------------------------------- |
| `fix:`                        | PATCH (0.0.x) | `fix: correct button alignment` |
| `feat:`                       | MINOR (0.x.0) | `feat: add dark mode`           |
| `feat!:` / `BREAKING CHANGE:` | MAJOR (x.0.0) | `feat!: redesign API`           |

---

## 5. ツール比較

| 項目                     | Manual + Auto-notes | Release Please         | Changesets               |
| ------------------------ | ------------------- | ---------------------- | ------------------------ |
| **セットアップ難易度**   | 低                  | 中                     | 高                       |
| **自動化レベル**         | 低                  | 高                     | 中                       |
| **人間の介入**           | 毎回                | PR承認のみ             | changeset追加            |
| **モノレポ対応**         | -                   | 可能                   | 最適                     |
| **Conventional Commits** | 推奨                | 必須                   | 不要                     |
| **適合プロジェクト**     | 小規模、シンプル    | 中規模、単一パッケージ | モノレポ、複数パッケージ |

---

## GitBox への推奨

### Phase 1: 即時実装（低コスト）

1. **`.github/release.yml`を追加**
   - GitHub Auto-generated Release Notesを有効化
   - PRラベルでカテゴリ分け

```yaml
# .github/release.yml
changelog:
  exclude:
    labels:
      - skip-changelog
      - dependencies
  categories:
    - title: '🚀 Features'
      labels:
        - feat
        - feature
        - enhancement
    - title: '🐛 Bug Fixes'
      labels:
        - fix
        - bug
    - title: '📚 Documentation'
      labels:
        - docs
        - documentation
    - title: '🔧 Maintenance'
      labels:
        - chore
        - refactor
        - test
```

2. **Conventional Commits推奨**（ESLint commitlintなし）
   - `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`

3. **手動リリースフロー**
   - GitHub UIで「Draft a new release」
   - タグ作成（v0.1.0形式）
   - Auto-generateボタンでリリースノート生成

### Phase 2: 将来実装（成熟後）

1. **Release Please導入**
   - リポジトリが活発になった後
   - Conventional Commits enforcement追加
   - 自動Release PR + Changelog管理

```yaml
# .github/workflows/release-please.yml
name: Release Please
on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          release-type: node
          changelog-types: |
            [
              {"type": "feat", "section": "Features"},
              {"type": "fix", "section": "Bug Fixes"},
              {"type": "chore", "section": "Maintenance"},
              {"type": "docs", "section": "Documentation"},
              {"type": "refactor", "section": "Refactoring"}
            ]
```

2. **release-please-config.json**

```json
{
  "packages": {
    ".": {
      "release-type": "node",
      "bump-minor-pre-major": true,
      "bump-patch-for-minor-pre-major": true
    }
  }
}
```

---

## 実装チェックリスト

### Phase 1 (推奨: 今すぐ)

- [ ] `.github/release.yml`を作成
- [ ] PRラベル（feat, fix, docs, chore）を設定
- [ ] 最初のリリース（v0.1.0）を手動作成
- [ ] READMEにバージョンバッジを追加

### Phase 2 (将来)

- [ ] commitlint + husky導入（Conventional Commits強制）
- [ ] Release Please Action追加
- [ ] CHANGELOG.md自動生成
- [ ] Vercel deploy preview on Release PR

---

## Sources

- https://github.com/excalidraw/excalidraw
- https://github.com/makeplane/plane
- https://github.com/outline/outline
- https://github.com/calcom/cal.com
- https://github.com/googleapis/release-please-action
- https://github.com/changesets/changesets
- https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes
