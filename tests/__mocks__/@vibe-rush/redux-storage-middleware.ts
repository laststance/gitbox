/**
 * Manual mock for @vibe-rush/redux-storage-middleware
 *
 * This mock is required because the monorepo package hasn't been built yet.
 * The actual package will be tested separately in T028.5.
 */

import type { Middleware } from '@reduxjs/toolkit'

export interface StorageMiddlewareConfig {
  slices: string[]
  storageKey: string
}

export const createStorageMiddleware = (_config: StorageMiddlewareConfig): Middleware => {
  // Mock middleware that passes actions through without modification
  return () => next => action => {
    return next(action)
  }
}
