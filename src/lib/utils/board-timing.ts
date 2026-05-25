import { env } from '@/lib/env'
import { createModuleLogger } from '@/lib/logger'

// Module-scoped child logger so every line is tagged { module: 'board-timing' }.
const log = createModuleLogger('board-timing')

/**
 * Emit a structured per-segment timing line for the /board/[id] read path.
 * Exists to make the embed read path's server-side cost measurable in prod;
 * triggered from `getBoardBundle` once per request and gated behind the
 * `BOARD_TIMING_LOG` server flag so it is a no-op unless explicitly enabled.
 * Because `getBoardBundle` is wrapped in `React.cache()`, a deduped second
 * call (generateMetadata + page) emits NO line — so counting lines per request
 * proves the dedup is working (1 line = deduped, 2 lines = not deduped).
 *
 * @param boardId - Board UUID being read (the only identifier logged; no PII).
 * @param segments - Map of segment name to elapsed milliseconds (e.g. `{ embedMs: 12.3 }`).
 * @returns Nothing; writes one structured log line when the flag is on, else no-op.
 * @example
 * logBoardTiming('a1b2c3d4-...', { embedMs: 12.3 })
 * // BOARD_TIMING_LOG=true → { module: 'board-timing', boardId: 'a1b2c3d4-...', embedMs: 12.3, msg: 'board-timing' }
 * // BOARD_TIMING_LOG unset → logs nothing
 */
export function logBoardTiming(
  boardId: string,
  segments: Record<string, number>,
): void {
  // Server-only opt-in; default off so production stays quiet unless toggled.
  if (!env.BOARD_TIMING_LOG) return
  log.info({ boardId, ...segments }, 'board-timing')
}
