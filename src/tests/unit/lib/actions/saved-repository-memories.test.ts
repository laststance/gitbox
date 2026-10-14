/**
 * Unit Tests: summarizeMemoryRow
 *
 * Which saved memories get a mark in the Add Repositories picker (issue #216):
 * a note or a comment with text other than whitespace, or a link with a URL,
 * counted after the same normalization the Note dialog uses. A comment color
 * alone is not worth a mark.
 *
 * @see src/lib/actions/saved-repository-memories.ts
 */

import { describe, expect, test } from 'vitest'

import { summarizeMemoryRow } from '@/lib/actions/saved-repository-memories'

describe('summarizeMemoryRow', () => {
  // Value: protects=the picker marks only memories that bring something back; fails_when=whitespace counts as a note, a color alone gets a mark, or a link without URL is counted; why_new=new rule (eng review R4); seam=none; no_claim=the database query (mocked out; e2e repository-memory.spec.ts)
  test.each([
    { holds: 'a note of spaces', note: '   ', comment: null, links: [] },
    { holds: 'an empty comment', note: null, comment: '', links: [] },
    {
      holds: 'a link without URL',
      note: '',
      comment: null,
      links: [{ type: 'vercel', url: ' ' }],
    },
    {
      holds: 'the default links value of the table',
      note: null,
      comment: null,
      links: {},
    },
  ])(
    'gives no mark to a memory that holds only $holds',
    ({ note, comment, links }) => {
      // Arrange
      const row = {
        repo_owner: 'laststance',
        repo_name: 'nsx',
        note,
        comment,
        links,
      }

      // Act
      const memory = summarizeMemoryRow(row)

      // Assert
      expect(memory).toBeNull()
    },
  )

  // Value: protects=links in the legacy categorized form are counted like the Note dialog shows them; fails_when=the raw JSON is measured instead of normalizeLinks; why_new=new rule (R4); seam=none; no_claim=none beyond protects
  test('counts the links of the legacy categorized form', () => {
    // Arrange
    const row = {
      repo_owner: 'laststance',
      repo_name: 'nsx',
      note: null,
      comment: null,
      links: {
        production: ['https://nsx.example.com'],
        tracking: ['https://sentry.example.com'],
      },
    }

    // Act
    const memory = summarizeMemoryRow(row)

    // Assert
    expect(memory).toEqual({
      identifier: 'laststance/nsx',
      hasNote: false,
      linkCount: 2,
      hasComment: false,
    })
  })

  // Value: protects=the mark matches the picker's lowercase repository key whatever the card's letter case; fails_when=the identifier keeps the stored case; why_new=new rule (R4); seam=none; no_claim=none beyond protects
  test('names the repository in lowercase and tells what is saved', () => {
    // Arrange
    const row = {
      repo_owner: 'LastStance',
      repo_name: 'NSX',
      note: 'CLI tool documentation',
      comment: 'v2.0リリース準備中',
      links: [{ type: 'npm', url: 'https://www.npmjs.com/package/nsx' }],
    }

    // Act
    const memory = summarizeMemoryRow(row)

    // Assert
    expect(memory).toEqual({
      identifier: 'laststance/nsx',
      hasNote: true,
      linkCount: 1,
      hasComment: true,
    })
  })
})
