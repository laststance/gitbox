# API Contracts

このディレクトリには、Vibe Rush で使用する API スキーマを配置します。

---

## 1. GitHub REST API (RTK Query Code Generation)

### スキーマソース
GitHub の公式 OpenAPI スキーマを使用:
- **URL**: https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json
- **フォーマット**: OpenAPI 3.0 (JSON)

### Code Generation コマンド

```bash
# RTK Query の自動生成スクリプトを package.json に追加
pnpm add -D @rtk-query/codegen-openapi

# GitHub REST API OpenAPI スキーマから TypeScript クライアントを生成
npx @rtk-query/codegen-openapi \
  --schemaFile https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json \
  --outputFile lib/github/api.ts \
  --reducerPath githubApi \
  --baseUrl https://api.github.com
```

### 生成されるファイル

**`lib/github/api.ts`**: 型安全な GitHub API クライアント

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const githubApi = createApi({
  reducerPath: 'githubApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://api.github.com',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.githubToken;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    // 自動生成されたエンドポイント
    getUserRepos: builder.query<Repository[], string>({
      query: (username) => `/users/${username}/repos`,
    }),
    searchRepos: builder.query<SearchResult, { q: string }>({
      query: ({ q }) => `/search/repositories?q=${q}`,
    }),
    // ...他のエンドポイント
  }),
});

export const {
  useGetUserReposQuery,
  useSearchReposQuery,
} = githubApi;
```

### 使用例

```typescript
// components/Board/AddRepositoryCombobox.tsx
import { useSearchReposQuery } from '@/lib/github/api';

function AddRepositoryCombobox() {
  const [query, setQuery] = useState('');
  const { data, isLoading } = useSearchReposQuery({ q: query });

  return (
    <Combobox>
      {data?.items.map((repo) => (
        <ComboboxOption key={repo.id} value={repo.full_name}>
          {repo.full_name}
        </ComboboxOption>
      ))}
    </Combobox>
  );
}
```

---

## 2. Supabase TypeScript Types (Database Schema)

### 型生成コマンド

```bash
# Supabase プロジェクトから TypeScript 型を自動生成
npx supabase gen types typescript --project-id <your-project-id> > lib/supabase/types.ts

# または、ローカル Supabase を使用している場合
npx supabase gen types typescript --local > lib/supabase/types.ts
```

### 生成されるファイル

**`lib/supabase/types.ts`**: Supabase DB の型定義

```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      Board: {
        Row: {
          id: string
          user_id: string
          name: string
          theme: string
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          theme?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          theme?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      // ...他のテーブル
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
```

### 使用例

```typescript
// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

// 型安全なクエリ
const { data } = await supabase
  .from('Board') // 型推論: Database['public']['Tables']['Board']
  .select('*')
  .eq('user_id', userId);
```

---

## 3. 型生成の自動化 (package.json)

```json
{
  "scripts": {
    "codegen:github": "npx @rtk-query/codegen-openapi --schemaFile https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json --outputFile lib/github/api.ts",
    "codegen:supabase": "npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > lib/supabase/types.ts",
    "codegen:supabase:local": "npx supabase gen types typescript --local > lib/supabase/types.ts",
    "codegen:all": "pnpm codegen:github && pnpm codegen:supabase"
  }
}
```

### CI/CD での自動生成

```yaml
# .github/workflows/ci.yml
- name: Generate API types
  run: |
    pnpm codegen:github
    pnpm codegen:supabase
    git diff --exit-code lib/github/api.ts lib/supabase/types.ts
  env:
    SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
```

---

## 参考資料

- [RTK Query Code Generation](https://redux-toolkit.js.org/rtk-query/usage/code-generation)
- [GitHub REST API OpenAPI Description](https://github.com/github/rest-api-description)
- [Supabase TypeScript Support](https://supabase.com/docs/guides/api/generating-types)
