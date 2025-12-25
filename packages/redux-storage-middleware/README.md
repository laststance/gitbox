# @gitbox/redux-storage-middleware

[![npm version](https://img.shields.io/npm/v/@gitbox/redux-storage-middleware)](https://www.npmjs.com/package/@gitbox/redux-storage-middleware)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

SSR-safe Redux Toolkit middleware for localStorage persistence with selective slice hydration, version migrations, and performance optimization.

## Highlights

- 🔒 **SSR-Safe**: Works seamlessly with Next.js App Router and Server Components
- 🎯 **Selective Persistence**: Choose which slices to persist with `slices`, `partialize`, or `exclude`
- 🔄 **Version Migrations**: Automatic schema migration with `version` and `migrate` options
- ⚡ **Performance Optimized**: Debounced/throttled writes, idle callback support
- 📦 **Pluggable Serializers**: JSON, SuperJSON (Date/Map/Set), LZ-String compression
- 🧪 **Battle-Tested**: 139 tests, 89.77% coverage, E2E verified with 5000+ items

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [createStorageMiddleware](#createstoragemiddlewaresoptions)
  - [Hydration API](#hydration-api)
  - [Storage Backends](#storage-backends)
  - [Serializers](#serializers)
- [Advanced Usage](#advanced-usage)
  - [Version Migrations](#version-migrations)
  - [Custom Merge Strategy](#custom-merge-strategy)
  - [SSR Integration](#ssr-integration)
  - [Exclude Paths](#exclude-paths)
- [Performance](#performance)
  - [Benchmark Results](#benchmark-results)
  - [10 Optimization Approaches](#10-optimization-approaches)
  - [Recommendations](#recommendations)
- [Testing](#testing)
- [Examples](#examples)
- [TypeScript Support](#typescript-support)
- [Migration Guide](#migration-guide)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

```bash
pnpm add @gitbox/redux-storage-middleware

# Optional serializers
pnpm add superjson     # For Date/Map/Set support
pnpm add lz-string     # For compression
```

**Peer Dependencies:**

```json
{
  "@reduxjs/toolkit": "^2.0.0",
  "react-redux": "^9.0.0"
}
```

---

## Quick Start

```typescript
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { createStorageMiddleware } from '@gitbox/redux-storage-middleware'

interface AppState {
  emails: EmailsState
  settings: SettingsState
}

// Create root reducer
const rootReducer = combineReducers({
  emails: emailReducer,
  settings: settingsReducer,
})

// Create middleware, reducer, and API
const { middleware, reducer, api } = createStorageMiddleware<AppState>({
  rootReducer, // Required: pass your root reducer
  name: 'my-app-state',
  slices: ['emails', 'settings'],
  version: 1,
})

// Configure store with returned reducer (already hydration-wrapped)
export const store = configureStore({
  reducer, // Use the returned reducer
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(middleware),
})

// Hydration happens automatically on client
// Export API for manual control
export { api as storageApi }
```

---

## API Reference

### `createStorageMiddleware<S>(options)`

Creates the storage middleware and returns both the middleware and a control API.

#### Configuration Options

| Option        | Type                        | Default        | Description                                            |
| ------------- | --------------------------- | -------------- | ------------------------------------------------------ |
| `rootReducer` | `Reducer<S, AnyAction>`     | **required**   | Root reducer to wrap with hydration handling           |
| `name`        | `string`                    | **required**   | localStorage key name                                  |
| `slices`      | `(keyof S)[]`               | `undefined`    | State slices to persist (all if undefined)             |
| `partialize`  | `(state: S) => Partial<S>`  | `undefined`    | Custom state selector function                         |
| `exclude`     | `string[]`                  | `[]`           | Dot-notation paths to exclude (e.g., `['auth.token']`) |
| `version`     | `number`                    | `0`            | Storage version for migrations                         |
| `storage`     | `StateStorage`              | `localStorage` | Custom storage backend                                 |
| `serializer`  | `Serializer<T>`             | JSON           | Custom serialization logic                             |
| `merge`       | `(persisted, current) => S` | shallow        | Merge strategy for hydration                           |
| `migrate`     | `(state, version) => S`     | identity       | Version migration function                             |

#### Performance Options

| Option                        | Type      | Default     | Description                            |
| ----------------------------- | --------- | ----------- | -------------------------------------- |
| `performance.debounceMs`      | `number`  | `300`       | Debounce delay for saves               |
| `performance.throttleMs`      | `number`  | `undefined` | Throttle interval (overrides debounce) |
| `performance.useIdleCallback` | `boolean` | `false`     | Use `requestIdleCallback`              |
| `performance.idleTimeout`     | `number`  | `1000`      | Fallback timeout for idle callback     |

#### Lifecycle Callbacks

| Callback              | Signature                    | Description                       |
| --------------------- | ---------------------------- | --------------------------------- |
| `onHydrate`           | `() => void`                 | Called when hydration starts      |
| `onHydrationComplete` | `(state: S) => void`         | Called when hydration completes   |
| `onSaveComplete`      | `(state: S) => void`         | Called after each save            |
| `onError`             | `(error, operation) => void` | Error handler for load/save/clear |

#### Returns

```typescript
interface StorageMiddlewareResult<S> {
  middleware: Middleware<object, S> // Redux middleware
  reducer: Reducer<S, AnyAction> // Hydration-wrapped reducer (use this in configureStore)
  api: HydrationApi<S> // Control API
}
```

---

### Hydration API

The `api` object returned from `createStorageMiddleware` provides control methods:

```typescript
interface HydrationApi<T> {
  // State management
  rehydrate(): Promise<void> // Manual hydration trigger
  hasHydrated(): boolean // Check if hydration completed
  getHydrationState(): HydrationState // 'idle' | 'hydrating' | 'hydrated' | 'error'
  getHydratedState(): T | null // Access the hydrated state

  // Storage control
  clearStorage(): void // Remove persisted state

  // Callbacks (returns unsubscribe function)
  onHydrate(cb: (state: T) => void): () => void
  onFinishHydration(cb: (state: T) => void): () => void
}
```

#### Hydration States

| State       | Description                                |
| ----------- | ------------------------------------------ |
| `idle`      | Initial state, hydration not yet attempted |
| `hydrating` | Hydration in progress                      |
| `hydrated`  | Hydration completed successfully           |
| `error`     | Hydration failed (storage/parse error)     |

---

### Storage Backends

Factory functions for different storage backends:

```typescript
import {
  createSafeLocalStorage, // SSR-safe localStorage wrapper
  createSafeSessionStorage, // SSR-safe sessionStorage wrapper
  createNoopStorage, // No-op storage (SSR fallback)
  createMemoryStorage, // In-memory storage for testing
  toAsyncStorage, // Convert sync to async wrapper
} from '@gitbox/redux-storage-middleware'

// Utility functions
import {
  isValidStorage, // Type guard for StateStorage
  getStorageSize, // Get item size in bytes
  getRemainingStorageQuota, // Estimate quota remaining
} from '@gitbox/redux-storage-middleware'
```

---

### Serializers

#### JSON Serializer (Default)

```typescript
import {
  createJsonSerializer, // Basic JSON serializer
  createEnhancedJsonSerializer, // With Date/Map/Set support
  defaultJsonSerializer, // Default instance
} from '@gitbox/redux-storage-middleware'

const serializer = createJsonSerializer({
  replacer: (key, value) => value, // Custom replacer
  reviver: (key, value) => value, // Custom reviver
  space: 2, // Indent for debugging
})
```

#### SuperJSON Serializer

Handles Date, Map, Set, undefined, BigInt automatically.

```typescript
import {
  initSuperJsonSerializer,
  createSuperJsonSerializer,
  isSuperJsonLoaded,
} from '@gitbox/redux-storage-middleware'

// Initialize once at app startup
await initSuperJsonSerializer()

// Create serializer
const serializer = createSuperJsonSerializer<AppState>()
```

#### Compressed Serializer

LZ-String based compression for large state.

```typescript
import {
  initCompressedSerializer,
  createCompressedSerializer,
  isLZStringLoaded,
  getCompressionRatio,
} from '@gitbox/redux-storage-middleware'

await initCompressedSerializer()

const serializer = createCompressedSerializer<AppState>({
  format: 'utf16' | 'base64' | 'uri', // default: 'utf16'
})
```

---

## Advanced Usage

### Version Migrations

```typescript
const { middleware, reducer } = createStorageMiddleware<AppState>({
  rootReducer,
  name: 'my-app',
  slices: ['settings'],
  version: 2,
  migrate: async (state, fromVersion) => {
    if (fromVersion === 1) {
      // Migrate from v1 to v2
      return {
        ...state,
        settings: {
          ...state.settings,
          newField: 'default',
        },
      }
    }
    return state
  },
})
```

### Custom Merge Strategy

```typescript
import { shallowMerge, deepMerge } from '@gitbox/redux-storage-middleware'

const { middleware, reducer } = createStorageMiddleware<AppState>({
  rootReducer,
  name: 'my-app',
  slices: ['emails'],
  merge: deepMerge, // or shallowMerge (default)
  // Or custom:
  // merge: (persisted, current) => ({
  //   ...current,
  //   emails: persisted.emails ?? current.emails,
  // }),
})
```

### SSR Integration

```typescript
// Next.js App Router pattern
'use client'

import { useEffect, useState } from 'react'
import { Provider } from 'react-redux'
import { store, storageApi } from './store'

export function StoreProvider({ children }) {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Subscribe to hydration completion
    const unsubscribe = storageApi.onFinishHydration(() => {
      setHydrated(true)
    })

    // Check if already hydrated
    if (storageApi.hasHydrated()) {
      setHydrated(true)
    }

    return unsubscribe
  }, [])

  if (!hydrated) {
    return <LoadingSpinner />
  }

  return <Provider store={store}>{children}</Provider>
}
```

### Exclude Paths

```typescript
const { middleware, reducer } = createStorageMiddleware<AppState>({
  rootReducer,
  name: 'my-app',
  exclude: [
    'auth.token', // Skip sensitive data
    'temp.loading', // Skip transient state
    'cache.responses', // Skip cache
  ],
})
```

### Partialize Function

```typescript
const { middleware, reducer } = createStorageMiddleware<AppState>({
  rootReducer,
  name: 'my-app',
  partialize: (state) => ({
    // Only persist specific nested data
    user: state.user.profile,
    settings: state.settings,
  }),
})
```

---

## Performance

### Benchmark Results (1000 emails)

| Metric            | Value    |
| ----------------- | -------- |
| JSON.stringify    | 0.32ms   |
| JSON.parse        | 0.41ms   |
| Storage Size      | ~460KB   |
| Full Round-trip   | 0.74ms   |
| Debounce Overhead | <0.001ms |

### 10 Optimization Approaches

We benchmarked 10 different localStorage optimization strategies:

| Approach                     | Write (ms) | Read (ms) | Size (KB) | Notes                                 |
| ---------------------------- | ---------- | --------- | --------- | ------------------------------------- |
| **1. Native JSON**           | 0.39       | 0.38      | 921       | Baseline - fast, no type preservation |
| **2. Type Preservation**     | 1.48       | 1.47      | 921       | Preserves Date, Map, Set              |
| **3. Compression**           | 1.12       | 1.28      | 1812      | Base64 overhead increases size        |
| **4. Selective Slices**      | 0.31       | 0.38      | 921       | Only persist critical slices          |
| **5. Debounced Writes**      | 3.06       | 0.40      | 461       | 10 changes → 1 write                  |
| **6. Throttled Writes**      | 1.56       | 0.42      | 461       | Rate-limited writes                   |
| **7. Differential Updates**  | 0.64       | 0.39      | 0.1       | Only store changed portions           |
| **8. Chunked Storage**       | 0.34       | 0.42      | 921       | Split into chunks                     |
| **9. Minimal Serialization** | 1.17       | 0.45      | 845       | Short keys (~8% smaller)              |
| **10. Lazy Hydration**       | 0.33       | 0.001     | 0.1       | Meta-first, full data on demand       |

### Large Dataset Performance (5000 emails)

| Metric          | Value  |
| --------------- | ------ |
| Storage Size    | ~4.5MB |
| Write Time      | ~2ms   |
| Read Time       | ~2ms   |
| Hydration (E2E) | ~500ms |

### Recommendations

| Use Case             | Recommended Approach                                     |
| -------------------- | -------------------------------------------------------- |
| **Most apps**        | Debounced writes (default 300ms) - reduces writes by 10x |
| **Large datasets**   | Lazy hydration - near-instant initial load               |
| **Frequent updates** | Differential updates - minimal data transfer             |
| **Type-rich data**   | Type preservation (SuperJSON) if you need Date/Map/Set   |

### Running Benchmarks

```bash
cd packages/redux-storage-middleware

# Core benchmarks
npx tsx benchmarks/benchmark.ts

# 10 optimization approaches
npx tsx benchmarks/optimization-approaches.ts
```

---

## Testing

### Unit Tests (Vitest)

```bash
pnpm test           # Watch mode
pnpm test:run       # Single run
pnpm test:coverage  # With coverage
```

**Coverage:** 139 tests with 89.77% coverage across 9 test files:

| Category              | Tests | Coverage                             |
| --------------------- | ----- | ------------------------------------ |
| Core Middleware       | 29    | Initialization, hydration, callbacks |
| Storage Layer         | 19    | localStorage, memory, async wrappers |
| JSON Serializer       | 18    | Basic, enhanced, replacers/revivers  |
| SuperJSON Serializer  | 16    | Async init, type handling, errors    |
| Compressed Serializer | 19    | LZ-String, formats, compression      |
| Utilities             | 24    | Debounce, throttle, SSR detection    |
| Package Exports       | 14    | All public API validation            |

### E2E Tests (Playwright)

```bash
pnpm build && pnpm test:e2e
```

13 tests including:

- 1000+ email load testing (<5s requirement)
- localStorage persistence verification
- Page reload hydration (<3s requirement)
- Debounce optimization verification

---

## Examples

### Gmail Clone Demo

A production-grade demo showing 5000+ email persistence:

**Location:** `/examples/gmail-clone`

**Stack:**

- Next.js 14 (App Router)
- Redux Toolkit 2.11
- shadcn/ui + Tailwind CSS
- Playwright E2E tests

**Features:**

- Real localStorage persistence
- Hydration status indicator
- Search & filter functionality
- Performance metrics display

**Configuration:**

```typescript
const { middleware, reducer, api } = createStorageMiddleware<AppState>({
  rootReducer, // Pass your root reducer
  name: 'gmail-clone-state',
  slices: ['emails'],
  version: 1,
  performance: {
    debounceMs: 300,
    useIdleCallback: false, // For E2E predictability
  },
  onHydrationComplete: (state) => {
    console.log('Hydrated:', state.emails?.emails?.length)
  },
})
```

**Run the demo:**

```bash
cd examples/gmail-clone
pnpm dev
```

---

## TypeScript Support

Full TypeScript support with generic state typing:

```typescript
// State type inference
const { middleware, reducer, api } = createStorageMiddleware<RootState>({
  rootReducer,  // Required: pass your root reducer
  name: 'app',
  slices: ['user', 'settings'],  // Type-checked against RootState keys
})

// Hydration API is typed
const state: RootState | null = api.getHydratedState()

// Nested path typing for exclude
type NestedKeyOf<T> = // ... supports 'auth.token', 'user.profile.name'
```

### Action Types

```typescript
import {
  ACTION_HYDRATE_START,
  ACTION_HYDRATE_COMPLETE,
  ACTION_HYDRATE_ERROR,
  type StorageMiddlewareAction,
} from '@gitbox/redux-storage-middleware'
```

> **Note:** `withHydration()` is deprecated. The returned `reducer` from `createStorageMiddleware()` is already hydration-wrapped.

---

## Migration Guide

### Upgrading from v0.1.x to v0.2.x

**Breaking Changes:**

1. `rootReducer` is now a required parameter
2. `skipHydration` option has been removed (hydration is always enabled)
3. Return type now includes `reducer` which must be used in `configureStore`

**Before (v0.1.x):**

```typescript
import {
  createStorageMiddleware,
  withHydration,
} from '@gitbox/redux-storage-middleware'

const rootReducer = combineReducers({
  settings: settingsReducer,
  board: boardReducer,
})

const { middleware } = createStorageMiddleware({
  name: 'my-app-state',
  slices: ['settings'],
  skipHydration: false, // This option no longer exists
})

const store = configureStore({
  reducer: withHydration(rootReducer), // Manual wrapper required
  middleware: (getDefault) => getDefault().concat(middleware),
})
```

**After (v0.2.x):**

```typescript
import { createStorageMiddleware } from '@gitbox/redux-storage-middleware'

const rootReducer = combineReducers({
  settings: settingsReducer,
  board: boardReducer,
})

const { middleware, reducer } = createStorageMiddleware({
  rootReducer, // Required: pass your root reducer
  name: 'my-app-state',
  slices: ['settings'],
})

const store = configureStore({
  reducer, // Use returned reducer (already hydration-wrapped)
  middleware: (getDefault) => getDefault().concat(middleware),
})
```

**Key Benefits of the New API:**

- No more "silent failures" from forgetting to use `withHydration()`
- Simpler, more intuitive API
- Automatic hydration on client (no need to configure `skipHydration`)

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass: `pnpm test:run`
5. Run linting: `pnpm lint`
6. Submit a pull request

### Development

```bash
# Install dependencies
pnpm install

# Run tests in watch mode
pnpm test

# Type checking
pnpm typecheck

# Build
pnpm build

# Run Gmail Clone example
cd examples/gmail-clone && pnpm dev
```

---

## License

MIT © [Laststance.io](https://github.com/laststance)

---

## Related

- [Redux Toolkit](https://redux-toolkit.js.org/)
- [redux-persist](https://github.com/rt2zz/redux-persist) - Original inspiration
- [zustand/persist](https://github.com/pmndrs/zustand) - Middleware pattern reference
- [jotai/atomWithStorage](https://jotai.org/docs/utilities/storage) - SSR patterns
