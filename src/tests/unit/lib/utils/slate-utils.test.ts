/**
 * Unit Tests: slate-utils
 *
 * Tests for Slate/Plate Editor Utility Functions including:
 * - parseSlateValue (JSON and legacy plain text parsing)
 * - serializeSlateValue (JSON serialization)
 * - extractAllText (text extraction)
 * - getSlateTextLength (character counting)
 * - isSlateValueEmpty (empty document detection)
 * - createSlateValueFromText (text to Slate conversion)
 */

import { describe, it, expect } from 'vitest'

import {
  parseSlateValue,
  serializeSlateValue,
  extractAllText,
  getSlateTextLength,
  isSlateValueEmpty,
  createSlateValueFromText,
} from '@/lib/utils/slate-utils'

describe('slate-utils', () => {
  const EMPTY_PARAGRAPH = { type: 'p', children: [{ text: '' }] }

  describe('parseSlateValue', () => {
    describe('empty/null input handling', () => {
      it('should return empty paragraph for null input', () => {
        const result = parseSlateValue(null)

        expect(result).toEqual([EMPTY_PARAGRAPH])
      })

      it('should return empty paragraph for undefined input', () => {
        const result = parseSlateValue(undefined)

        expect(result).toEqual([EMPTY_PARAGRAPH])
      })

      it('should return empty paragraph for empty string', () => {
        const result = parseSlateValue('')

        expect(result).toEqual([EMPTY_PARAGRAPH])
      })

      it('should return empty paragraph for whitespace-only string', () => {
        const result = parseSlateValue('   ')

        expect(result).toEqual([EMPTY_PARAGRAPH])
      })

      it('should return empty paragraph for tabs and newlines only', () => {
        const result = parseSlateValue('\t\n\n')

        expect(result).toEqual([EMPTY_PARAGRAPH])
      })
    })

    describe('JSON parsing (new format)', () => {
      it('should parse valid JSON array with single paragraph', () => {
        const json = '[{"type":"p","children":[{"text":"Test"}]}]'

        const result = parseSlateValue(json)

        expect(result).toEqual([{ type: 'p', children: [{ text: 'Test' }] }])
      })

      it('should parse valid JSON array with multiple paragraphs', () => {
        const json =
          '[{"type":"p","children":[{"text":"Hello"}]},{"type":"p","children":[{"text":"World"}]}]'

        const result = parseSlateValue(json)

        expect(result).toEqual([
          { type: 'p', children: [{ text: 'Hello' }] },
          { type: 'p', children: [{ text: 'World' }] },
        ])
      })

      it('should parse JSON with heading elements', () => {
        const json =
          '[{"type":"h1","children":[{"text":"Title"}]},{"type":"p","children":[{"text":"Content"}]}]'

        const result = parseSlateValue(json)

        expect(result).toEqual([
          { type: 'h1', children: [{ text: 'Title' }] },
          { type: 'p', children: [{ text: 'Content' }] },
        ])
      })

      it('should parse JSON with nested elements', () => {
        const json =
          '[{"type":"blockquote","children":[{"type":"p","children":[{"text":"Quote"}]}]}]'

        const result = parseSlateValue(json)

        expect(result).toEqual([
          {
            type: 'blockquote',
            children: [{ type: 'p', children: [{ text: 'Quote' }] }],
          },
        ])
      })

      it('should handle JSON with leading/trailing whitespace', () => {
        const json = '  [{"type":"p","children":[{"text":"Test"}]}]  '

        const result = parseSlateValue(json)

        expect(result).toEqual([{ type: 'p', children: [{ text: 'Test' }] }])
      })

      it('should handle JSON with formatting marks', () => {
        const json =
          '[{"type":"p","children":[{"text":"Bold","bold":true},{"text":" and "},{"text":"italic","italic":true}]}]'

        const result = parseSlateValue(json)

        expect(result).toEqual([
          {
            type: 'p',
            children: [
              { text: 'Bold', bold: true },
              { text: ' and ' },
              { text: 'italic', italic: true },
            ],
          },
        ])
      })
    })

    describe('JSON parsing edge cases', () => {
      it('should fall back to plain text for invalid JSON', () => {
        const invalidJson = '[{"type":"p", invalid'

        const result = parseSlateValue(invalidJson)

        // Should treat as plain text
        expect(result).toEqual([
          { type: 'p', children: [{ text: '[{"type":"p", invalid' }] },
        ])
      })

      it('should fall back to plain text for empty JSON array', () => {
        const emptyArray = '[]'

        const result = parseSlateValue(emptyArray)

        // Empty array fails validation, treat as plain text
        expect(result).toEqual([{ type: 'p', children: [{ text: '[]' }] }])
      })

      it('should fall back to plain text for JSON object (not array)', () => {
        const jsonObject = '{"type":"p","children":[{"text":"Test"}]}'

        const result = parseSlateValue(jsonObject)

        // Not an array, treat as plain text
        expect(result).toEqual([
          {
            type: 'p',
            children: [{ text: '{"type":"p","children":[{"text":"Test"}]}' }],
          },
        ])
      })
    })

    describe('legacy plain text parsing', () => {
      it('should convert single line text to paragraph', () => {
        const result = parseSlateValue('Hello')

        expect(result).toEqual([{ type: 'p', children: [{ text: 'Hello' }] }])
      })

      it('should convert multi-line text to multiple paragraphs', () => {
        const result = parseSlateValue('Hello\nWorld')

        expect(result).toEqual([
          { type: 'p', children: [{ text: 'Hello' }] },
          { type: 'p', children: [{ text: 'World' }] },
        ])
      })

      it('should preserve empty lines as empty paragraphs', () => {
        const result = parseSlateValue('Line 1\n\nLine 3')

        expect(result).toEqual([
          { type: 'p', children: [{ text: 'Line 1' }] },
          { type: 'p', children: [{ text: '' }] },
          { type: 'p', children: [{ text: 'Line 3' }] },
        ])
      })

      it('should handle text starting with [ but not valid JSON', () => {
        const result = parseSlateValue('[Not JSON')

        expect(result).toEqual([
          { type: 'p', children: [{ text: '[Not JSON' }] },
        ])
      })

      it('should handle special characters in plain text', () => {
        const result = parseSlateValue('Hello <world> & "friends"')

        expect(result).toEqual([
          { type: 'p', children: [{ text: 'Hello <world> & "friends"' }] },
        ])
      })

      it('should handle unicode characters', () => {
        const result = parseSlateValue('日本語テスト\n🎉 Emoji')

        expect(result).toEqual([
          { type: 'p', children: [{ text: '日本語テスト' }] },
          { type: 'p', children: [{ text: '🎉 Emoji' }] },
        ])
      })
    })
  })

  describe('serializeSlateValue', () => {
    it('should serialize single paragraph to JSON', () => {
      const value = [{ type: 'p', children: [{ text: 'Test' }] }]

      const result = serializeSlateValue(value)

      expect(result).toBe('[{"type":"p","children":[{"text":"Test"}]}]')
    })

    it('should serialize multiple paragraphs to JSON', () => {
      const value = [
        { type: 'p', children: [{ text: 'Hello' }] },
        { type: 'p', children: [{ text: 'World' }] },
      ]

      const result = serializeSlateValue(value)

      expect(result).toBe(
        '[{"type":"p","children":[{"text":"Hello"}]},{"type":"p","children":[{"text":"World"}]}]',
      )
    })

    it('should serialize elements with formatting marks', () => {
      const value = [
        {
          type: 'p',
          children: [{ text: 'Bold', bold: true }],
        },
      ]

      const result = serializeSlateValue(value)

      expect(JSON.parse(result)).toEqual(value)
    })

    it('should serialize nested elements', () => {
      const value = [
        {
          type: 'ul',
          children: [
            { type: 'li', children: [{ text: 'Item 1' }] },
            { type: 'li', children: [{ text: 'Item 2' }] },
          ],
        },
      ]

      const result = serializeSlateValue(value)

      expect(JSON.parse(result)).toEqual(value)
    })

    it('should preserve special characters in serialization', () => {
      const value = [
        { type: 'p', children: [{ text: 'Hello "world" & <friends>' }] },
      ]

      const result = serializeSlateValue(value)

      expect(JSON.parse(result)).toEqual(value)
    })
  })

  describe('extractAllText', () => {
    it('should extract text from single paragraph', () => {
      const value = [{ type: 'p', children: [{ text: 'Hello' }] }]

      const result = extractAllText(value)

      expect(result).toBe('Hello')
    })

    it('should join multiple paragraphs with newlines', () => {
      const value = [
        { type: 'p', children: [{ text: 'Hello' }] },
        { type: 'p', children: [{ text: 'World' }] },
      ]

      const result = extractAllText(value)

      expect(result).toBe('Hello\nWorld')
    })

    it('should concatenate multiple text nodes in same element', () => {
      const value = [
        {
          type: 'p',
          children: [{ text: 'Hello ' }, { text: 'World' }],
        },
      ]

      const result = extractAllText(value)

      expect(result).toBe('Hello World')
    })

    it('should extract text from different element types', () => {
      const value = [
        { type: 'h1', children: [{ text: 'Title' }] },
        { type: 'p', children: [{ text: 'Content' }] },
      ]

      const result = extractAllText(value)

      expect(result).toBe('Title\nContent')
    })

    it('should handle nested elements', () => {
      const value = [
        {
          type: 'blockquote',
          children: [{ type: 'p', children: [{ text: 'Quote' }] }],
        },
      ]

      const result = extractAllText(value)

      expect(result).toBe('Quote')
    })

    it('should ignore formatting marks in extraction', () => {
      const value = [
        {
          type: 'p',
          children: [{ text: 'Bold', bold: true }, { text: ' normal' }],
        },
      ]

      const result = extractAllText(value)

      expect(result).toBe('Bold normal')
    })

    it('should handle empty value array', () => {
      const value: { type: string; children: { text: string }[] }[] = []

      const result = extractAllText(value)

      expect(result).toBe('')
    })

    it('should handle empty text nodes', () => {
      const value = [{ type: 'p', children: [{ text: '' }] }]

      const result = extractAllText(value)

      expect(result).toBe('')
    })

    it('should handle list structures', () => {
      const value = [
        {
          type: 'ul',
          children: [
            { type: 'li', children: [{ text: 'Item 1' }] },
            { type: 'li', children: [{ text: 'Item 2' }] },
          ],
        },
      ]

      const result = extractAllText(value)

      expect(result).toBe('Item 1Item 2')
    })

    it('should handle element without children array', () => {
      // Edge case: element without children property
      const value = [{ type: 'hr' }] as any

      const result = extractAllText(value)

      expect(result).toBe('')
    })
  })

  describe('getSlateTextLength', () => {
    it('should return 0 for empty paragraph', () => {
      const value = [{ type: 'p', children: [{ text: '' }] }]

      const result = getSlateTextLength(value)

      expect(result).toBe(0)
    })

    it('should count characters in single paragraph', () => {
      const value = [{ type: 'p', children: [{ text: 'Hello' }] }]

      const result = getSlateTextLength(value)

      expect(result).toBe(5)
    })

    it('should count characters across multiple paragraphs', () => {
      const value = [
        { type: 'p', children: [{ text: 'Hello' }] },
        { type: 'h1', children: [{ text: 'Title' }] },
      ]

      const result = getSlateTextLength(value)

      expect(result).toBe(10) // 5 + 5, newlines not counted
    })

    it('should count characters in multiple text nodes', () => {
      const value = [
        {
          type: 'p',
          children: [{ text: 'Hello ' }, { text: 'World' }],
        },
      ]

      const result = getSlateTextLength(value)

      expect(result).toBe(11)
    })

    it('should count unicode characters correctly', () => {
      const value = [{ type: 'p', children: [{ text: '日本語' }] }]

      const result = getSlateTextLength(value)

      expect(result).toBe(3)
    })

    it('should count emojis as multiple characters (surrogate pairs)', () => {
      const value = [{ type: 'p', children: [{ text: '🎉' }] }]

      const result = getSlateTextLength(value)

      // Emoji is 2 characters (surrogate pair) in JavaScript
      expect(result).toBe(2)
    })

    it('should handle empty value array', () => {
      const value: { type: string; children: { text: string }[] }[] = []

      const result = getSlateTextLength(value)

      expect(result).toBe(0)
    })

    it('should count spaces', () => {
      const value = [{ type: 'p', children: [{ text: 'a b c' }] }]

      const result = getSlateTextLength(value)

      expect(result).toBe(5)
    })
  })

  describe('isSlateValueEmpty', () => {
    it('should return true for null value', () => {
      const result = isSlateValueEmpty(null as any)

      expect(result).toBe(true)
    })

    it('should return true for empty array', () => {
      const result = isSlateValueEmpty([])

      expect(result).toBe(true)
    })

    it('should return true for empty paragraph', () => {
      const value = [{ type: 'p', children: [{ text: '' }] }]

      const result = isSlateValueEmpty(value)

      expect(result).toBe(true)
    })

    it('should return true for whitespace-only content', () => {
      const value = [{ type: 'p', children: [{ text: '   ' }] }]

      const result = isSlateValueEmpty(value)

      expect(result).toBe(true)
    })

    it('should return true for multiple empty paragraphs', () => {
      const value = [
        { type: 'p', children: [{ text: '' }] },
        { type: 'p', children: [{ text: '  ' }] },
      ]

      const result = isSlateValueEmpty(value)

      expect(result).toBe(true)
    })

    it('should return false for content with text', () => {
      const value = [{ type: 'p', children: [{ text: 'Hello' }] }]

      const result = isSlateValueEmpty(value)

      expect(result).toBe(false)
    })

    it('should return false for content with single character', () => {
      const value = [{ type: 'p', children: [{ text: 'a' }] }]

      const result = isSlateValueEmpty(value)

      expect(result).toBe(false)
    })

    it('should return false for content with emoji', () => {
      const value = [{ type: 'p', children: [{ text: '🎉' }] }]

      const result = isSlateValueEmpty(value)

      expect(result).toBe(false)
    })

    it('should return false for content with newlines and text', () => {
      const value = [
        { type: 'p', children: [{ text: '' }] },
        { type: 'p', children: [{ text: 'Text' }] },
      ]

      const result = isSlateValueEmpty(value)

      expect(result).toBe(false)
    })
  })

  describe('createSlateValueFromText', () => {
    it('should return empty paragraph for null input', () => {
      const result = createSlateValueFromText(null as any)

      expect(result).toEqual([EMPTY_PARAGRAPH])
    })

    it('should return empty paragraph for empty string', () => {
      const result = createSlateValueFromText('')

      expect(result).toEqual([EMPTY_PARAGRAPH])
    })

    it('should return empty paragraph for whitespace-only string', () => {
      const result = createSlateValueFromText('   ')

      expect(result).toEqual([EMPTY_PARAGRAPH])
    })

    it('should create single paragraph from single line', () => {
      const result = createSlateValueFromText('Hello')

      expect(result).toEqual([{ type: 'p', children: [{ text: 'Hello' }] }])
    })

    it('should create multiple paragraphs from multi-line text', () => {
      const result = createSlateValueFromText('Hello\nWorld')

      expect(result).toEqual([
        { type: 'p', children: [{ text: 'Hello' }] },
        { type: 'p', children: [{ text: 'World' }] },
      ])
    })

    it('should preserve empty lines as empty paragraphs', () => {
      const result = createSlateValueFromText('Line 1\n\nLine 3')

      expect(result).toEqual([
        { type: 'p', children: [{ text: 'Line 1' }] },
        { type: 'p', children: [{ text: '' }] },
        { type: 'p', children: [{ text: 'Line 3' }] },
      ])
    })

    it('should handle Windows line endings (CRLF)', () => {
      const result = createSlateValueFromText('Line 1\r\nLine 2')

      // Note: split('\n') will leave \r at end of first line
      expect(result[0]!.children[0]!.text).toBe('Line 1\r')
      expect(result[1]!.children[0]!.text).toBe('Line 2')
    })

    it('should handle unicode characters', () => {
      const result = createSlateValueFromText('日本語\n🎉')

      expect(result).toEqual([
        { type: 'p', children: [{ text: '日本語' }] },
        { type: 'p', children: [{ text: '🎉' }] },
      ])
    })

    it('should handle special characters', () => {
      const result = createSlateValueFromText('<script>alert("xss")</script>')

      expect(result).toEqual([
        { type: 'p', children: [{ text: '<script>alert("xss")</script>' }] },
      ])
    })
  })

  describe('round-trip consistency', () => {
    it('should maintain data integrity through serialize → parse cycle', () => {
      const original = [
        { type: 'h1', children: [{ text: 'Title' }] },
        {
          type: 'p',
          children: [{ text: 'Paragraph with ' }, { text: 'bold', bold: true }],
        },
      ]

      const serialized = serializeSlateValue(original)
      const parsed = parseSlateValue(serialized)

      expect(parsed).toEqual(original)
    })

    it('should maintain data integrity through createFromText → extractAllText cycle', () => {
      const original = 'Hello\nWorld\nTest'

      const slateValue = createSlateValueFromText(original)
      const extracted = extractAllText(slateValue)

      expect(extracted).toBe(original)
    })

    it('should produce parseable JSON from serialization', () => {
      const value = [
        {
          type: 'p',
          children: [
            { text: 'Special chars: ' },
            { text: '"quotes"', bold: true },
            { text: ' & <brackets>' },
          ],
        },
      ]

      const serialized = serializeSlateValue(value)
      const reparsed = parseSlateValue(serialized)

      expect(reparsed).toEqual(value)
    })
  })
})
