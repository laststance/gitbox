/**
 * Storage Middleware Configuration
 *
 * Instantiation of custom redux-storage-middleware package
 */

import { createStorageMiddleware } from '@gitbox/redux-storage-middleware'

/**
 * LocalStorage synchronization middleware
 *
 * Saves only settings slice to LocalStorage
 * Persists theme, language, typography settings, etc.
 */
export { createStorageMiddleware }
