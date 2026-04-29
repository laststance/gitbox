'use client'

import {
  BlockquoteRules,
  BoldRules,
  CodeRules,
  HeadingRules,
  HighlightRules,
  HorizontalRuleRules,
  ItalicRules,
  MarkComboRules,
  StrikethroughRules,
  SubscriptRules,
  SuperscriptRules,
  UnderlineRules,
} from '@platejs/basic-nodes'
import { CodeBlockRules } from '@platejs/code-block'
import {
  BulletedListRules,
  OrderedListRules,
  TaskListRules,
} from '@platejs/list'
import { createSlatePlugin, KEYS } from 'platejs'

// Disable autoformat inside code blocks (preserves v52 query behavior).
const isNotInCodeBlock = (context: {
  editor: {
    api: { some: (options: { match: { type: string } }) => boolean }
    getType: (key: string) => string
  }
}) =>
  !context.editor.api.some({
    match: { type: context.editor.getType(KEYS.codeBlock) },
  })

export const AutoformatKit = [
  createSlatePlugin({
    key: 'markdownShortcuts',
    inputRules: [
      HeadingRules.markdown({ enabled: isNotInCodeBlock }),
      BlockquoteRules.markdown({ enabled: isNotInCodeBlock }),
      HorizontalRuleRules.markdown({ variant: '-', enabled: isNotInCodeBlock }),
      HorizontalRuleRules.markdown({ variant: '_', enabled: isNotInCodeBlock }),
      CodeBlockRules.markdown({ on: 'match', enabled: isNotInCodeBlock }),
      MarkComboRules.markdown({
        variant: 'boldItalic',
        enabled: isNotInCodeBlock,
      }),
      MarkComboRules.markdown({
        variant: 'boldUnderline',
        enabled: isNotInCodeBlock,
      }),
      MarkComboRules.markdown({
        variant: 'italicUnderline',
        enabled: isNotInCodeBlock,
      }),
      MarkComboRules.markdown({
        variant: 'boldItalicUnderline',
        enabled: isNotInCodeBlock,
      }),
      BoldRules.markdown({ variant: '*', enabled: isNotInCodeBlock }),
      BoldRules.markdown({ variant: '_', enabled: isNotInCodeBlock }),
      ItalicRules.markdown({ variant: '*', enabled: isNotInCodeBlock }),
      ItalicRules.markdown({ variant: '_', enabled: isNotInCodeBlock }),
      UnderlineRules.markdown({ enabled: isNotInCodeBlock }),
      StrikethroughRules.markdown({ enabled: isNotInCodeBlock }),
      SubscriptRules.markdown({ enabled: isNotInCodeBlock }),
      SuperscriptRules.markdown({ enabled: isNotInCodeBlock }),
      HighlightRules.markdown({ variant: '==', enabled: isNotInCodeBlock }),
      HighlightRules.markdown({ variant: '≡', enabled: isNotInCodeBlock }),
      CodeRules.markdown({ enabled: isNotInCodeBlock }),
      BulletedListRules.markdown({ variant: '*', enabled: isNotInCodeBlock }),
      BulletedListRules.markdown({ variant: '-', enabled: isNotInCodeBlock }),
      OrderedListRules.markdown({ variant: '.', enabled: isNotInCodeBlock }),
      OrderedListRules.markdown({ variant: ')', enabled: isNotInCodeBlock }),
      TaskListRules.markdown({ checked: false, enabled: isNotInCodeBlock }),
      TaskListRules.markdown({ checked: true, enabled: isNotInCodeBlock }),
    ],
  }),
]
