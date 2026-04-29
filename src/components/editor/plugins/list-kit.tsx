'use client'

import {
  BulletedListRules,
  OrderedListRules,
  TaskListRules,
} from '@platejs/list'
import { ListPlugin } from '@platejs/list/react'
import { KEYS } from 'platejs'

import { IndentKit } from '@/components/editor/plugins/indent-kit'
import { BlockList } from '@/components/ui/block-list'

import { isMarkdownShortcutEnabled } from './autoformat-kit'

export const ListKit = [
  ...IndentKit,
  ListPlugin.configure({
    inputRules: [
      BulletedListRules.markdown({
        variant: '*',
        enabled: isMarkdownShortcutEnabled,
      }),
      BulletedListRules.markdown({
        variant: '-',
        enabled: isMarkdownShortcutEnabled,
      }),
      OrderedListRules.markdown({
        variant: '.',
        enabled: isMarkdownShortcutEnabled,
      }),
      OrderedListRules.markdown({
        variant: ')',
        enabled: isMarkdownShortcutEnabled,
      }),
      TaskListRules.markdown({
        checked: false,
        enabled: isMarkdownShortcutEnabled,
      }),
      TaskListRules.markdown({
        checked: true,
        enabled: isMarkdownShortcutEnabled,
      }),
    ],
    inject: {
      targetPlugins: [
        ...KEYS.heading,
        KEYS.p,
        KEYS.blockquote,
        KEYS.codeBlock,
        KEYS.toggle,
        KEYS.img,
      ],
    },
    render: {
      belowNodes: BlockList,
    },
  }),
]
