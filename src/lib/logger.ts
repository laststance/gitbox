/**
 * Server-side Logger Module
 *
 * Provides structured logging using Pino for server-side code.
 * Uses JSON format in production for log aggregation tools.
 *
 * @module lib/logger
 *
 * @example
 * // In Server Actions or API routes
 * import { logger } from '@/lib/logger'
 *
 * logger.info({ userId: '123' }, 'User logged in')
 * logger.error({ error, boardId }, 'Failed to fetch board')
 */

import pino from 'pino'

// Note: pino-pretty transport doesn't work with Next.js Turbopack.
// Use JSON format for all environments, pipe to pino-pretty CLI if needed:
// `pnpm dev 2>&1 | pnpm exec pino-pretty`
export const logger = pino({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

/**
 * Creates a child logger with module context.
 * Use this to create loggers for specific modules.
 *
 * @param module - The module name for log identification
 * @returns {pino.Logger} Child logger with module context
 *
 * @example
 * // In lib/actions/board.ts
 * const log = createModuleLogger('board')
 * log.info({ boardId }, 'Board created')
 * // Output: { "level": "info", "module": "board", "boardId": "123", "msg": "Board created" }
 */
export const createModuleLogger = (module: string): pino.Logger => {
  return logger.child({ module })
}
