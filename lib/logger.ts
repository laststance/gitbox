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

/**
 * Determines if the logger should use pretty printing.
 * Uses human-readable format in development, JSON in production.
 *
 * @returns {boolean} Whether to use pretty printing
 */
const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development'
}

/**
 * Creates a Pino logger instance with appropriate configuration.
 *
 * @returns {pino.Logger} Configured Pino logger
 *
 * @example
 * // Log levels available:
 * logger.debug({ data }, 'Debug message')    // Level 20
 * logger.info({ data }, 'Info message')      // Level 30
 * logger.warn({ data }, 'Warning message')   // Level 40
 * logger.error({ error }, 'Error message')   // Level 50
 * logger.fatal({ error }, 'Fatal error')     // Level 60
 */
const createLogger = (): pino.Logger => {
  return pino({
    level: isDevelopment() ? 'debug' : 'info',
    ...(isDevelopment()
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        }
      : {
          // Production: JSON format for log aggregation
          formatters: {
            level: (label) => ({ level: label }),
          },
          timestamp: pino.stdTimeFunctions.isoTime,
        }),
  })
}

/**
 * Main logger instance for server-side code.
 *
 * @example
 * // Basic usage
 * logger.info('Server started')
 *
 * // With context object
 * logger.error({ error, userId }, 'Failed to process request')
 *
 * // Creating child logger with bound context
 * const childLogger = logger.child({ module: 'board' })
 * childLogger.info({ boardId }, 'Board loaded')
 */
export const logger = createLogger()

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

export default logger
