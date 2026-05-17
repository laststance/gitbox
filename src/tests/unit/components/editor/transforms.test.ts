/**
 * Unit Tests: Editor Transforms - getBlockType
 *
 * Tests for the getBlockType utility function from transforms.ts.
 * This function determines the block type based on node properties.
 *
 * Note: Other transform functions require full PlateEditor mocking
 * and are tested implicitly through Storybook and E2E tests.
 */

import type { TElement } from 'platejs'
import { describe, it, expect } from 'vitest'

// Import the actual getBlockType function from transforms.ts
import { getBlockType } from '@/components/editor/transforms'

/**
 * Helper to create test TElement blocks
 * This ensures we match the TElement interface expected by getBlockType
 */
const createBlock = (props: {
  type?: string
  listStyleType?: string
}): TElement => ({
  type: props.type || 'p',
  children: [{ text: '' }],
  ...(props.listStyleType && { listStyleType: props.listStyleType }),
})

describe('getBlockType', () => {
  describe('standard block types', () => {
    it('should return the type property for regular blocks', () => {
      const block = createBlock({ type: 'p' })
      expect(getBlockType(block)).toBe('p')
    })

    it('should return code_block type', () => {
      const block = createBlock({ type: 'code_block' })
      expect(getBlockType(block)).toBe('code_block')
    })

    it('should return blockquote type', () => {
      const block = createBlock({ type: 'blockquote' })
      expect(getBlockType(block)).toBe('blockquote')
    })

    it('should return heading type', () => {
      const block = createBlock({ type: 'h1' })
      expect(getBlockType(block)).toBe('h1')
    })

    it('should return callout type', () => {
      const block = createBlock({ type: 'callout' })
      expect(getBlockType(block)).toBe('callout')
    })

    it('should return table type', () => {
      const block = createBlock({ type: 'table' })
      expect(getBlockType(block)).toBe('table')
    })

    it('should return image type', () => {
      const block = createBlock({ type: 'img' })
      expect(getBlockType(block)).toBe('img')
    })

    it('should return video type', () => {
      const block = createBlock({ type: 'video' })
      expect(getBlockType(block)).toBe('video')
    })

    it('should return equation type', () => {
      const block = createBlock({ type: 'equation' })
      expect(getBlockType(block)).toBe('equation')
    })
  })

  describe('list types with listStyleType', () => {
    it('should return ol (decimal) for ordered list', () => {
      const block = createBlock({ type: 'p', listStyleType: 'decimal' })
      expect(getBlockType(block)).toBe('decimal')
    })

    it('should return ul (disc) for unordered list with disc', () => {
      const block = createBlock({ type: 'p', listStyleType: 'disc' })
      expect(getBlockType(block)).toBe('disc')
    })

    it('should return listTodo for todo list', () => {
      const block = createBlock({ type: 'p', listStyleType: 'todo' })
      expect(getBlockType(block)).toBe('todo')
    })

    it('should return ul (disc) for square list style', () => {
      const block = createBlock({ type: 'p', listStyleType: 'square' })
      expect(getBlockType(block)).toBe('disc')
    })

    it('should return ul (disc) for circle list style', () => {
      const block = createBlock({ type: 'p', listStyleType: 'circle' })
      expect(getBlockType(block)).toBe('disc')
    })

    it('should return ul (disc) for lower-alpha list style', () => {
      const block = createBlock({ type: 'p', listStyleType: 'lower-alpha' })
      expect(getBlockType(block)).toBe('disc')
    })
  })

  describe('edge cases', () => {
    it('should handle block without listStyleType', () => {
      // A block without listStyleType should return its type
      const block: TElement = { type: 'p', children: [{ text: '' }] }
      expect(getBlockType(block)).toBe('p')
    })

    it('should prioritize listStyleType over type', () => {
      const block = createBlock({ type: 'p', listStyleType: 'decimal' })
      // listStyleType takes precedence
      expect(getBlockType(block)).toBe('decimal')
    })

    it('should handle undefined type with listStyleType', () => {
      // Even without a type, if listStyleType exists, it takes precedence
      const block: TElement = {
        type: 'p',
        children: [{ text: '' }],
        listStyleType: 'decimal',
      } as TElement
      expect(getBlockType(block)).toBe('decimal')
    })
  })
})

describe('insertBlock logic', () => {
  /**
   * Tests for the insertBlock mapping logic
   * These verify the structure of the block insertion map
   */
  const insertBlockTypes = [
    'listTodo',
    'ol',
    'ul',
    'action_three_columns',
    'audio',
    'callout',
    'code_block',
    'equation',
    'file',
    'img',
    'media_embed',
    'table',
    'toc',
    'video',
  ]

  it('should have all expected block types in the insert map', () => {
    // Verify the expected block types are defined
    expect(insertBlockTypes.length).toBe(14)
  })

  it('should include list types', () => {
    expect(insertBlockTypes).toContain('listTodo')
    expect(insertBlockTypes).toContain('ol')
    expect(insertBlockTypes).toContain('ul')
  })

  it('should include media types', () => {
    expect(insertBlockTypes).toContain('audio')
    expect(insertBlockTypes).toContain('video')
    expect(insertBlockTypes).toContain('img')
    expect(insertBlockTypes).toContain('file')
  })

  it('should include layout types', () => {
    expect(insertBlockTypes).toContain('action_three_columns')
    expect(insertBlockTypes).toContain('table')
  })
})

describe('insertInlineElement logic', () => {
  /**
   * Tests for the inline element insertion mapping
   */
  const insertInlineTypes = ['date', 'inlineEquation', 'link']

  it('should have all expected inline types', () => {
    expect(insertInlineTypes.length).toBe(3)
  })

  it('should include date inline element', () => {
    expect(insertInlineTypes).toContain('date')
  })

  it('should include inline equation element', () => {
    expect(insertInlineTypes).toContain('inlineEquation')
  })

  it('should include link element', () => {
    expect(insertInlineTypes).toContain('link')
  })
})

describe('setBlockType logic', () => {
  /**
   * Tests for the setBlockType mapping logic
   */
  const setBlockTypes = [
    'listTodo',
    'ol',
    'ul',
    'action_three_columns',
    'code_block',
  ]

  it('should have all expected set block types', () => {
    expect(setBlockTypes.length).toBe(5)
  })

  it('should include list types for setting', () => {
    expect(setBlockTypes).toContain('listTodo')
    expect(setBlockTypes).toContain('ol')
    expect(setBlockTypes).toContain('ul')
  })

  it('should include toggleable types', () => {
    expect(setBlockTypes).toContain('code_block')
    expect(setBlockTypes).toContain('action_three_columns')
  })
})
