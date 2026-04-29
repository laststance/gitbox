'use client'

import { KEYS, type SlateEditor } from 'platejs'

/**
 * Keeps markdown shortcuts disabled inside code blocks.
 *
 * Plate v53 input rules run from each feature plugin, so this shared gate keeps
 * the previous behavior consistent for headings, marks, lists, and code fences.
 *
 * @example
 * H1Plugin.configure({
 *   inputRules: [HeadingRules.markdown({ enabled: isMarkdownShortcutEnabled })],
 * })
 */
export function isMarkdownShortcutEnabled(context: {
  editor: SlateEditor
}): boolean {
  return !context.editor.api.some({
    match: { type: context.editor.getType(KEYS.codeBlock) },
  })
}
