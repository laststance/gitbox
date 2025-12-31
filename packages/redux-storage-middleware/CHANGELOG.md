# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking Changes

- **Renamed `name` config option to `key`** - Better semantic clarity for localStorage key parameter
- Renamed parameter in `SyncStorage`/`AsyncStorage` interfaces from `name` to `key` (matches Web Storage API)
- Removed `version` config option (internal version is always 0)
- Removed `migrate` callback
- Removed `partialize` option
- Removed `exclude` option
- Removed `storage` option (always uses localStorage)
- Removed `serializer` option (always uses JSON)
- Removed `merge` option (always uses shallow merge)
- Removed `onHydrate` callback
- Removed `MigrateFn` type export
- Removed `PersistedState` type export (now internal)

### Migration Guide

```diff
const { middleware, reducer, api } = createStorageMiddleware({
  rootReducer,
- name: 'my-app-state',
+ key: 'my-app-state',
  slices: ['settings'],
})
```

### Rationale

YAGNI cleanup - these options were never used in production. The API surface has been reduced by approximately 50% (from 15 options to 7) while maintaining all actually-used functionality.

### Kept Options

- `rootReducer` - Required root reducer
- `key` - Storage key for localStorage
- `slices` - Selective slice persistence
- `performance` - Debounce/throttle configuration
- `onHydrationComplete` - Hydration complete callback
- `onSaveComplete` - Save complete callback
- `onError` - Error handling callback
