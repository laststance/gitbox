'use client'

import { HeadingRules } from '@platejs/basic-nodes'
import {
  BlockquotePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  H6Plugin,
  HorizontalRulePlugin,
} from '@platejs/basic-nodes/react'
import { KEYS } from 'platejs'
import { ParagraphPlugin } from 'platejs/react'

import { BlockquoteElement } from '@/components/ui/blockquote-node'
import {
  H1Element,
  H2Element,
  H3Element,
  H4Element,
  H5Element,
  H6Element,
} from '@/components/ui/heading-node'
import { HrElement } from '@/components/ui/hr-node'
import { ParagraphElement } from '@/components/ui/paragraph-node'

// Disable heading shortcuts inside code blocks (preserves v52 query behavior).
const isNotInCodeBlock = (context: {
  editor: {
    api: { some: (options: { match: { type: string } }) => boolean }
    getType: (key: string) => string
  }
}) =>
  !context.editor.api.some({
    match: { type: context.editor.getType(KEYS.codeBlock) },
  })

export const BasicBlocksKit = [
  ParagraphPlugin.withComponent(ParagraphElement),
  H1Plugin.configure({
    node: {
      component: H1Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: 'mod+alt+1' } },
    inputRules: [HeadingRules.markdown({ enabled: isNotInCodeBlock })],
  }),
  H2Plugin.configure({
    node: {
      component: H2Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: 'mod+alt+2' } },
    inputRules: [HeadingRules.markdown({ enabled: isNotInCodeBlock })],
  }),
  H3Plugin.configure({
    node: {
      component: H3Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: 'mod+alt+3' } },
    inputRules: [HeadingRules.markdown({ enabled: isNotInCodeBlock })],
  }),
  H4Plugin.configure({
    node: {
      component: H4Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: 'mod+alt+4' } },
    inputRules: [HeadingRules.markdown({ enabled: isNotInCodeBlock })],
  }),
  H5Plugin.configure({
    node: {
      component: H5Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: 'mod+alt+5' } },
    inputRules: [HeadingRules.markdown({ enabled: isNotInCodeBlock })],
  }),
  H6Plugin.configure({
    node: {
      component: H6Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: 'mod+alt+6' } },
    inputRules: [HeadingRules.markdown({ enabled: isNotInCodeBlock })],
  }),
  BlockquotePlugin.configure({
    node: { component: BlockquoteElement },
    shortcuts: { toggle: { keys: 'mod+shift+period' } },
  }),
  HorizontalRulePlugin.withComponent(HrElement),
]
