'use client'

import { CodeBlockRules } from '@platejs/code-block'
import {
  CodeBlockPlugin,
  CodeLinePlugin,
  CodeSyntaxPlugin,
} from '@platejs/code-block/react'
import { all, createLowlight } from 'lowlight'

import {
  CodeBlockElement,
  CodeLineElement,
  CodeSyntaxLeaf,
} from '@/components/ui/code-block-node'

import { isMarkdownShortcutEnabled } from './autoformat-kit'

const lowlight = createLowlight(all)

export const CodeBlockKit = [
  CodeBlockPlugin.configure({
    inputRules: [
      CodeBlockRules.markdown({
        on: 'match',
        enabled: isMarkdownShortcutEnabled,
      }),
    ],
    node: { component: CodeBlockElement },
    options: { lowlight },
    shortcuts: { toggle: { keys: 'mod+alt+8' } },
  }),
  CodeLinePlugin.withComponent(CodeLineElement),
  CodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),
]
