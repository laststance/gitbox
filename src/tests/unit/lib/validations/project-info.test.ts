/**
 * Project Info Validation Schemas Tests
 */

import { describe, expect, test } from 'vitest'

import {
  NOTE_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  VALID_COMMENT_COLORS,
  noteSchema,
  commentSchema,
  commentColorSchema,
  projectLinkUrlSchema,
  projectLinkSchema,
  linksInputSchema,
  validateNoteWithSchema,
  validateCommentWithSchema,
  validateCommentColorWithSchema,
  validateUrlWithSchema,
} from '@/lib/validations/project-info'

describe('noteSchema', () => {
  test('accepts valid short note', () => {
    const result = noteSchema.safeParse('A simple note')
    expect(result.success).toBe(true)
  })

  test('accepts empty string', () => {
    const result = noteSchema.safeParse('')
    expect(result.success).toBe(true)
  })

  test('accepts valid Slate JSON format', () => {
    const slateJson = JSON.stringify([
      { type: 'p', children: [{ text: 'Hello World' }] },
    ])
    const result = noteSchema.safeParse(slateJson)
    expect(result.success).toBe(true)
  })

  test(`rejects note exceeding ${NOTE_MAX_LENGTH} characters (plain text)`, () => {
    const longNote = 'x'.repeat(NOTE_MAX_LENGTH + 1)
    const result = noteSchema.safeParse(longNote)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('20000')
  })

  test(`accepts note at exactly ${NOTE_MAX_LENGTH} characters`, () => {
    const maxNote = 'x'.repeat(NOTE_MAX_LENGTH)
    const result = noteSchema.safeParse(maxNote)
    expect(result.success).toBe(true)
  })

  test('rejects note exceeding max length (Slate JSON format)', () => {
    // Create a Slate value with too much text
    const longText = 'x'.repeat(NOTE_MAX_LENGTH + 1)
    const slateJson = JSON.stringify([
      { type: 'p', children: [{ text: longText }] },
    ])
    const result = noteSchema.safeParse(slateJson)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('20000')
  })

  test('handles invalid JSON array (converted to plain text by parseSlateValue)', () => {
    // String that starts with [ but is invalid JSON
    // parseSlateValue handles this internally by converting to plain text
    const invalidJson = '[invalid json'
    const result = noteSchema.safeParse(invalidJson)
    expect(result.success).toBe(true) // Valid because it's converted to a paragraph
  })

  test('accepts plain text that exceeds max length after paragraph conversion', () => {
    // Plain text gets converted to paragraphs by parseSlateValue
    // Length is calculated from actual text content
    const plainTextTooLong = 'a'.repeat(NOTE_MAX_LENGTH + 1)
    const result = noteSchema.safeParse(plainTextTooLong)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('20000')
  })
})

describe('commentSchema', () => {
  test('accepts valid comment', () => {
    const result = commentSchema.safeParse('A simple comment')
    expect(result.success).toBe(true)
  })

  test('accepts empty string', () => {
    const result = commentSchema.safeParse('')
    expect(result.success).toBe(true)
  })

  test(`rejects comment exceeding ${COMMENT_MAX_LENGTH} characters`, () => {
    const longComment = 'x'.repeat(COMMENT_MAX_LENGTH + 1)
    const result = commentSchema.safeParse(longComment)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('2000')
  })
})

describe('commentColorSchema', () => {
  test.each(VALID_COMMENT_COLORS)('accepts valid color: %s', (color) => {
    const result = commentColorSchema.safeParse(color)
    expect(result.success).toBe(true)
    expect(result.data).toBe(color)
  })

  test('rejects invalid color', () => {
    const result = commentColorSchema.safeParse('invalid-color')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('Invalid')
  })
})

describe('projectLinkUrlSchema', () => {
  test('accepts valid https URL', () => {
    const result = projectLinkUrlSchema.safeParse('https://example.com')
    expect(result.success).toBe(true)
  })

  test('accepts valid http URL', () => {
    const result = projectLinkUrlSchema.safeParse('http://localhost:3000')
    expect(result.success).toBe(true)
  })

  test('accepts empty string (filtered out later)', () => {
    const result = projectLinkUrlSchema.safeParse('')
    expect(result.success).toBe(true)
  })

  test('rejects URL without protocol', () => {
    const result = projectLinkUrlSchema.safeParse('example.com')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('http')
  })

  test('rejects malformed URL', () => {
    const result = projectLinkUrlSchema.safeParse('https://')
    expect(result.success).toBe(false)
  })

  test('rejects URL with valid protocol but invalid format', () => {
    // URL has http:// but the rest is malformed enough to fail URL constructor
    const result = projectLinkUrlSchema.safeParse('https://[invalid')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('Invalid URL')
  })
})

describe('projectLinkSchema', () => {
  test('accepts valid link', () => {
    const result = projectLinkSchema.safeParse({
      type: 'vercel',
      url: 'https://vercel.com/my-project',
    })
    expect(result.success).toBe(true)
  })

  test('rejects missing type', () => {
    const result = projectLinkSchema.safeParse({
      type: '',
      url: 'https://example.com',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('required')
  })
})

describe('linksInputSchema', () => {
  test('accepts new format (array)', () => {
    const result = linksInputSchema.safeParse([
      { type: 'vercel', url: 'https://vercel.com' },
      { type: 'sentry', url: 'https://sentry.io' },
    ])
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
  })

  test('transforms old format (object) to new format', () => {
    const result = linksInputSchema.safeParse({
      production: ['https://prod.example.com'],
      tracking: ['https://analytics.example.com'],
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual([
      { type: 'production', url: 'https://prod.example.com' },
      { type: 'tracking', url: 'https://analytics.example.com' },
    ])
  })

  test('handles old format with supabase category', () => {
    const result = linksInputSchema.safeParse({
      supabase: ['https://supabase.com/dashboard'],
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual([
      { type: 'supabase', url: 'https://supabase.com/dashboard' },
    ])
  })

  test('accepts empty array', () => {
    const result = linksInputSchema.safeParse([])
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })
})

describe('validateNoteWithSchema', () => {
  test('returns success for valid note', () => {
    const result = validateNoteWithSchema('Valid note')
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  test('returns error for invalid note', () => {
    const result = validateNoteWithSchema('x'.repeat(NOTE_MAX_LENGTH + 1))
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('validateCommentWithSchema', () => {
  test('returns success for valid comment', () => {
    const result = validateCommentWithSchema('Valid comment')
    expect(result.success).toBe(true)
  })

  test('returns error for invalid comment', () => {
    const result = validateCommentWithSchema('x'.repeat(COMMENT_MAX_LENGTH + 1))
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('validateCommentColorWithSchema', () => {
  test('returns success for valid color', () => {
    const result = validateCommentColorWithSchema('primary')
    expect(result.success).toBe(true)
  })

  test('returns error for invalid color', () => {
    const result = validateCommentColorWithSchema('invalid')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('validateUrlWithSchema', () => {
  test('returns success for valid URL', () => {
    const result = validateUrlWithSchema('https://example.com')
    expect(result.success).toBe(true)
  })

  test('returns error for invalid URL', () => {
    const result = validateUrlWithSchema('not-a-url')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
