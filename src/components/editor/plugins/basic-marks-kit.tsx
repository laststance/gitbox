'use client'

import {
  BoldRules,
  CodeRules,
  HighlightRules,
  ItalicRules,
  MarkComboRules,
  StrikethroughRules,
  SubscriptRules,
  SuperscriptRules,
  UnderlineRules,
} from '@platejs/basic-nodes'
import {
  BoldPlugin,
  CodePlugin,
  HighlightPlugin,
  ItalicPlugin,
  KbdPlugin,
  StrikethroughPlugin,
  SubscriptPlugin,
  SuperscriptPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react'

import { CodeLeaf } from '@/components/ui/code-node'
import { HighlightLeaf } from '@/components/ui/highlight-node'
import { KbdLeaf } from '@/components/ui/kbd-node'

import { isMarkdownShortcutEnabled } from './autoformat-kit'

export const BasicMarksKit = [
  BoldPlugin.configure({
    inputRules: [
      MarkComboRules.markdown({
        variant: 'boldItalic',
        enabled: isMarkdownShortcutEnabled,
      }),
      MarkComboRules.markdown({
        variant: 'boldUnderline',
        enabled: isMarkdownShortcutEnabled,
      }),
      MarkComboRules.markdown({
        variant: 'italicUnderline',
        enabled: isMarkdownShortcutEnabled,
      }),
      MarkComboRules.markdown({
        variant: 'boldItalicUnderline',
        enabled: isMarkdownShortcutEnabled,
      }),
      BoldRules.markdown({ variant: '*', enabled: isMarkdownShortcutEnabled }),
      BoldRules.markdown({ variant: '_', enabled: isMarkdownShortcutEnabled }),
    ],
  }),
  ItalicPlugin.configure({
    inputRules: [
      ItalicRules.markdown({
        variant: '*',
        enabled: isMarkdownShortcutEnabled,
      }),
      ItalicRules.markdown({
        variant: '_',
        enabled: isMarkdownShortcutEnabled,
      }),
    ],
  }),
  UnderlinePlugin.configure({
    inputRules: [
      UnderlineRules.markdown({ enabled: isMarkdownShortcutEnabled }),
    ],
  }),
  CodePlugin.configure({
    inputRules: [CodeRules.markdown({ enabled: isMarkdownShortcutEnabled })],
    node: { component: CodeLeaf },
    shortcuts: { toggle: { keys: 'mod+e' } },
  }),
  StrikethroughPlugin.configure({
    inputRules: [
      StrikethroughRules.markdown({ enabled: isMarkdownShortcutEnabled }),
    ],
    shortcuts: { toggle: { keys: 'mod+shift+x' } },
  }),
  SubscriptPlugin.configure({
    inputRules: [
      SubscriptRules.markdown({ enabled: isMarkdownShortcutEnabled }),
    ],
    shortcuts: { toggle: { keys: 'mod+comma' } },
  }),
  SuperscriptPlugin.configure({
    inputRules: [
      SuperscriptRules.markdown({ enabled: isMarkdownShortcutEnabled }),
    ],
    shortcuts: { toggle: { keys: 'mod+period' } },
  }),
  HighlightPlugin.configure({
    inputRules: [
      HighlightRules.markdown({
        variant: '==',
        enabled: isMarkdownShortcutEnabled,
      }),
    ],
    node: { component: HighlightLeaf },
    shortcuts: { toggle: { keys: 'mod+shift+h' } },
  }),
  KbdPlugin.withComponent(KbdLeaf),
]
