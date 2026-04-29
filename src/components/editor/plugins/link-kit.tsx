'use client'

import { LinkRules } from '@platejs/link'
import { LinkPlugin } from '@platejs/link/react'

import { LinkElement } from '@/components/ui/link-node'
import { LinkFloatingToolbar } from '@/components/ui/link-toolbar'

import { isMarkdownShortcutEnabled } from './autoformat-kit'

export const LinkKit = [
  LinkPlugin.configure({
    inputRules: [
      LinkRules.markdown({ enabled: isMarkdownShortcutEnabled }),
      LinkRules.autolink({
        variant: 'paste',
        enabled: isMarkdownShortcutEnabled,
      }),
      LinkRules.autolink({
        variant: 'space',
        enabled: isMarkdownShortcutEnabled,
      }),
      LinkRules.autolink({
        variant: 'break',
        enabled: isMarkdownShortcutEnabled,
      }),
    ],
    render: {
      node: LinkElement,
      afterEditable: () => <LinkFloatingToolbar />,
    },
  }),
]
