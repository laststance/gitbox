/**
 * Unit Tests: readEveryRow()
 *
 * A PostgREST read stops at 1000 rows. These tests lock the loop that asks
 * for the next page, and the stop when a page repeats, which would otherwise
 * request the same rows forever.
 *
 * @see src/lib/utils/read-every-row.ts
 */

import { describe, expect, test } from 'vitest'

import { POSTGREST_MAX_ROWS } from '@/lib/constants/postgrest'
import { readEveryRow } from '@/lib/utils/read-every-row'

describe('readEveryRow()', () => {
  test('returns the one page when it is shorter than the cap', async () => {
    // Arrange
    const fetchPage = async () =>
      Promise.resolve({ data: [{ id: 'a' }, { id: 'b' }], error: null })

    // Act
    const rows = await readEveryRow(fetchPage)

    // Assert
    expect(rows).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  test('concatenates the next page when the first page is full', async () => {
    // Arrange
    const first = Array.from({ length: POSTGREST_MAX_ROWS }, (_, index) => ({
      id: `row-${index}`,
    }))
    const second = [{ id: 'row-1000' }]
    const pages = [first, second]
    const ranges: Array<[number, number]> = []
    const fetchPage = async (from: number, to: number) => {
      ranges.push([from, to])
      const page = pages[ranges.length - 1] ?? []
      return Promise.resolve({ data: page, error: null })
    }

    // Act
    const rows = await readEveryRow(fetchPage)

    // Assert
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    expect(rows).toHaveLength(1001)
    expect(rows[1000]).toEqual({ id: 'row-1000' })
  })

  test('throws when a page fails, so the caller does not keep a partial list', async () => {
    // Arrange
    const fetchPage = async () =>
      Promise.resolve({
        data: null,
        error: { message: 'canceling statement' },
      })

    // Act
    const rows = readEveryRow(fetchPage)

    // Assert
    await expect(rows).rejects.toThrow('canceling statement')
  })

  test('throws when a full page starts with the same row as the previous one', async () => {
    // Arrange: `.range()` ignored, every request returns the same 1000 rows
    const page = Array.from({ length: POSTGREST_MAX_ROWS }, () => ({
      id: 'same',
    }))
    let calls = 0
    const fetchPage = async () => {
      calls += 1
      return Promise.resolve({ data: page, error: null })
    }

    // Act
    const rows = readEveryRow(fetchPage)

    // Assert
    await expect(rows).rejects.toThrow('The database page did not advance')
    expect(calls).toBe(2)
  })
})
