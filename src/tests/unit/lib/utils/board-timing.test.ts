/**
 * Unit Tests: logBoardTiming() — BOARD_TIMING_LOG flag gating + module tag
 *
 * Locks in the opt-in contract for the /board/[id] read-path timing probe: when
 * BOARD_TIMING_LOG is off (the production default) logBoardTiming must be a
 * silent no-op; when it is on it must emit exactly one structured line tagged
 * with the board-timing module and carrying the board id plus every timing
 * segment. This regresses if the `if (!env.BOARD_TIMING_LOG) return` guard is
 * dropped (prod log spam), if the module tag is changed (orphans the grep key
 * operators use to isolate these lines), or if the payload shape drifts.
 *
 * Scope: flag gating, module tag, and single-call payload shape only. The
 * "1 line per request = React.cache dedup is working" property lives in
 * getBoardBundle (src/lib/actions/board-data.ts) and is covered there, not here.
 *
 * @see src/lib/utils/board-timing.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted so the vi.mock factories below (which are hoisted above the imports)
// can close over them, and the test body can flip the flag, assert on the
// emitted line, and assert on the module tag passed to createModuleLogger.
const { mockEnv, infoSpy, createModuleLoggerSpy } = vi.hoisted(() => {
  const infoSpy = vi.fn()
  return {
    mockEnv: { BOARD_TIMING_LOG: false },
    infoSpy,
    // Spy on createModuleLogger itself (not just its returned logger) so the
    // test can prove every line is tagged with the 'board-timing' module name.
    createModuleLoggerSpy: vi.fn(() => ({ info: infoSpy })),
  }
})

// logBoardTiming reads env.BOARD_TIMING_LOG at call time, so a plain mutable
// object lets each test pick the flag state before invoking.
vi.mock('@/lib/env', () => ({ env: mockEnv }))

// createModuleLogger runs once at board-timing.ts load time; the returned
// logger's .info is the single spy the assertions target. The mock is
// intentionally minimal (only .info) — logBoardTiming calls nothing else.
vi.mock('@/lib/logger', () => ({ createModuleLogger: createModuleLoggerSpy }))

import { logBoardTiming } from '@/lib/utils/board-timing'

describe('logBoardTiming() BOARD_TIMING_LOG gating', () => {
  beforeEach(() => {
    // Clear only the log spy between tests; leave createModuleLoggerSpy intact
    // so its single module-load call survives for the module-tag assertion.
    // Default the flag off (the production default) so each test opts in.
    infoSpy.mockClear()
    mockEnv.BOARD_TIMING_LOG = false
  })

  it('does not emit a timing line when BOARD_TIMING_LOG is off', () => {
    // Arrange
    mockEnv.BOARD_TIMING_LOG = false

    // Act
    logBoardTiming('00000000-0000-0000-0000-000000000100', { embedMs: 12.3 })

    // Assert
    expect(infoSpy).not.toHaveBeenCalled()
  })

  it('emits one timing line carrying the board id and every segment when BOARD_TIMING_LOG is on', () => {
    // Arrange
    mockEnv.BOARD_TIMING_LOG = true

    // Act
    logBoardTiming('00000000-0000-0000-0000-000000000100', {
      embedMs: 12.3,
      remapMs: 4.5,
    })

    // Assert
    expect(infoSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).toHaveBeenCalledWith(
      {
        boardId: '00000000-0000-0000-0000-000000000100',
        embedMs: 12.3,
        remapMs: 4.5,
      },
      'board-timing',
    )
  })

  it('emits one line carrying only the board id when segments is empty and BOARD_TIMING_LOG is on', () => {
    // Arrange
    mockEnv.BOARD_TIMING_LOG = true

    // Act
    logBoardTiming('00000000-0000-0000-0000-000000000100', {})

    // Assert
    expect(infoSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).toHaveBeenCalledWith(
      { boardId: '00000000-0000-0000-0000-000000000100' },
      'board-timing',
    )
  })

  it('tags its log lines with the board-timing module name', () => {
    // Assert — createModuleLogger runs once at module load, never re-cleared,
    // so a re-tag of the module name (which would orphan the prod grep key)
    // fails here even though the emitted-line tests would still pass.
    expect(createModuleLoggerSpy).toHaveBeenCalledTimes(1)
    expect(createModuleLoggerSpy).toHaveBeenCalledWith('board-timing')
  })
})
