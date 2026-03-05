/**
 * Slate/Plate Editor Utility Functions
 *
 * Provides conversion utilities between Slate JSON format and plain text,
 * with backward compatibility for legacy plain text storage.
 */

import { destr } from 'destr'
import type { Descendant, Element, Text, Value } from 'platejs'

/**
 * Slate value type representing the document structure.
 * At the root level, this is always an array of elements (not text nodes).
 * This matches Plate's Value type expectation.
 */
export type SlateValue = Value

/**
 * Default empty paragraph for initializing empty editor state.
 * Uses 'p' as the paragraph type per Plate conventions.
 */
const EMPTY_PARAGRAPH: Element = {
  type: 'p',
  children: [{ text: '' }],
}

/**
 * Parse stored data into Slate value format.
 * Handles both JSON (new format) and plain text (legacy format).
 *
 * @param data - Raw string from database (JSON or plain text)
 * @returns Slate-compatible document value
 * @example
 * parseSlateValue(null)
 * // => [{ type: 'p', children: [{ text: '' }] }]
 *
 * parseSlateValue('Hello\nWorld')
 * // => [{ type: 'p', children: [{ text: 'Hello' }] },
 * //     { type: 'p', children: [{ text: 'World' }] }]
 *
 * parseSlateValue('[{"type":"p","children":[{"text":"Test"}]}]')
 * // => [{ type: 'p', children: [{ text: 'Test' }] }]
 */
export function parseSlateValue(data: string | null | undefined): SlateValue {
  // Empty or null returns default empty paragraph
  if (!data || data.trim() === '') {
    return [EMPTY_PARAGRAPH]
  }

  const trimmed = data.trim()

  // Attempt safe parse if it looks like JSON array
  if (trimmed.startsWith('[')) {
    const parsed = destr<SlateValue>(trimmed)

    // Validate it's an array with at least one element
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
  }

  // Legacy plain text: convert each line to a paragraph
  const lines = data.split('\n')
  return lines.map((line) => ({
    type: 'p',
    children: [{ text: line }],
  }))
}

/**
 * Serialize Slate value to JSON string for database storage.
 *
 * @param value - Slate document value
 * @returns JSON string representation
 * @example
 * serializeSlateValue([{ type: 'p', children: [{ text: 'Hello' }] }])
 * // => '[{"type":"p","children":[{"text":"Hello"}]}]'
 */
export function serializeSlateValue(value: SlateValue): string {
  return JSON.stringify(value)
}

/**
 * Type guard to check if a node is a text node.
 *
 * @param node - Slate node to check
 * @returns True if node is a text node
 */
function isTextNode(node: Element | Descendant): node is Text {
  return 'text' in node && typeof (node as Text).text === 'string'
}

/**
 * Recursively extract all text content from a Slate node.
 *
 * @param node - Slate node (element or text)
 * @returns Plain text content of the node
 */
function extractTextFromNode(node: Element | Descendant): string {
  if (isTextNode(node)) {
    return (node as Text).text
  }

  // Element node: recursively extract from children
  const element = node as Element
  if (Array.isArray(element.children)) {
    return element.children.map(extractTextFromNode).join('')
  }

  return ''
}

/**
 * Extract all plain text from a Slate value.
 * Joins block elements with newlines.
 *
 * @param value - Slate document value
 * @returns Plain text representation
 * @example
 * extractAllText([
 *   { type: 'p', children: [{ text: 'Hello' }] },
 *   { type: 'p', children: [{ text: 'World' }] }
 * ])
 * // => 'Hello\nWorld'
 */
export function extractAllText(value: SlateValue): string {
  return value.map(extractTextFromNode).join('\n')
}

/**
 * Get the character count of all text in a Slate value.
 * Used for validation (e.g., max length checks).
 *
 * @param value - Slate document value
 * @returns Total character count (excluding formatting)
 * @example
 * getSlateTextLength([
 *   { type: 'p', children: [{ text: 'Hello' }] },
 *   { type: 'h1', children: [{ text: 'Title' }] }
 * ])
 * // => 10 (5 + 5, newlines not counted in this calculation)
 */
export function getSlateTextLength(value: SlateValue): number {
  return value.reduce((total, node) => {
    return total + extractTextFromNode(node).length
  }, 0)
}

/**
 * Check if the Slate value represents an empty document.
 * An empty document has no meaningful text content.
 *
 * @param value - Slate document value
 * @returns True if document is empty or contains only whitespace
 * @example
 * isSlateValueEmpty([{ type: 'p', children: [{ text: '' }] }])
 * // => true
 *
 * isSlateValueEmpty([{ type: 'p', children: [{ text: 'Hi' }] }])
 * // => false
 */
export function isSlateValueEmpty(value: SlateValue): boolean {
  if (!value || value.length === 0) return true

  const text = extractAllText(value).trim()
  return text === ''
}

/**
 * Create a simple Slate value from plain text.
 * Useful for programmatic content creation.
 *
 * @param text - Plain text to convert
 * @returns Slate value with paragraphs for each line
 * @example
 * createSlateValueFromText('Hello\nWorld')
 * // => [{ type: 'p', children: [{ text: 'Hello' }] },
 * //     { type: 'p', children: [{ text: 'World' }] }]
 */
export function createSlateValueFromText(text: string): SlateValue {
  if (!text || text.trim() === '') {
    return [EMPTY_PARAGRAPH]
  }

  return text.split('\n').map((line) => ({
    type: 'p',
    children: [{ text: line }],
  }))
}
