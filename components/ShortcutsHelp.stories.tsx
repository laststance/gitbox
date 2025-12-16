/**
 * Storybook: ShortcutsHelp Component
 *
 * Constitution要件: Principle III - コンポーネント文書化必須
 *
 * Stories:
 * - Default: デフォルト表示（閉じた状態）
 * - Open: 開いた状態
 */

import type { Meta, StoryObj } from '@storybook/react';
import { ShortcutsHelp } from './ShortcutsHelp';

const meta = {
  title: 'Components/ShortcutsHelp',
  component: ShortcutsHelp,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'キーボードショートカットヘルプモーダル。? キーで開閉、ESCキーで閉じることができます。',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    defaultOpen: {
      control: 'boolean',
      description: '初期状態でモーダルを開くかどうか',
      defaultValue: false,
    },
  },
} satisfies Meta<typeof ShortcutsHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * デフォルト状態（閉じた状態）
 *
 * ? キーを押すとモーダルが開きます。
 */
export const Default: Story = {
  args: {
    defaultOpen: false,
  },
  render: (args) => (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Keyboard Shortcuts Demo</h2>
        <p className="text-muted-foreground">
          Press{' '}
          <kbd className="px-2 py-1 text-sm font-semibold bg-muted border border-border rounded">
            ?
          </kbd>{' '}
          to open shortcuts help
        </p>
        <ShortcutsHelp {...args} />
      </div>
    </div>
  ),
};

/**
 * 開いた状態
 *
 * ショートカット一覧が表示されます。
 */
export const Open: Story = {
  args: {
    defaultOpen: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'モーダルが開いた状態。カテゴリ別に整理されたショートカット一覧が表示されます。',
      },
    },
  },
};

/**
 * Dark Mode
 *
 * ダークモードでの表示。
 */
export const DarkMode: Story = {
  args: {
    defaultOpen: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
};

/**
 * Accessibility Test
 *
 * WCAG AA準拠確認用。
 * - キーボードナビゲーション
 * - フォーカス管理
 * - スクリーンリーダー対応
 */
export const AccessibilityTest: Story = {
  args: {
    defaultOpen: true,
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'keyboard-navigation',
            enabled: true,
          },
        ],
      },
    },
  },
};
