/**
 * CommentDisplay Component Stories
 *
 * Card-in-Card style comment display component for RepoCard.
 * Shows inline comments with configurable styling options.
 *
 * Phase 3: Display only (read-only)
 * Phase 4: Will add inline editing
 *
 * @see https://github.com/laststance/gitbox/issues/20
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  CommentDisplay,
  COMMENT_BORDER_COLORS,
  COMMENT_BG_COLORS,
  COMMENT_FONT_SIZES,
  COMMENT_FONT_WEIGHTS,
} from './CommentDisplay'

const meta = {
  title: 'Board/CommentDisplay',
  component: CommentDisplay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[320px] p-4 bg-card rounded-lg border">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    style: {
      description: 'Style configuration for the comment display',
    },
  },
} satisfies Meta<typeof CommentDisplay>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default state with a comment
 */
export const Default: Story = {
  args: {
    comment: 'npmリリース完了、当分は機能追加予定なし',
    onClick: () => console.log('Comment clicked'),
  },
}

/**
 * Empty state with "Add comment" placeholder
 */
export const EmptyState: Story = {
  args: {
    comment: '',
    onClick: () => console.log('Empty state clicked'),
    showEmptyState: true,
  },
}

/**
 * Empty state hidden (null render)
 */
export const EmptyStateHidden: Story = {
  args: {
    comment: '',
    showEmptyState: false,
  },
}

/**
 * Long comment that spans multiple lines
 */
export const LongComment: Story = {
  args: {
    comment:
      'プロトタイプ作ったけど微妙、差分表示エディタで苦戦中。リファクタリング予定あり。チームでレビュー待ち。',
    onClick: () => console.log('Comment clicked'),
  },
}

/**
 * Short comment
 */
export const ShortComment: Story = {
  args: {
    comment: 'WIP',
    onClick: () => console.log('Comment clicked'),
  },
}

// ============================================================================
// Border Color Variants
// ============================================================================

export const BorderColorBlue: Story = {
  args: {
    comment: 'Blue border accent',
    style: { borderColor: 'blue' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const BorderColorGreen: Story = {
  args: {
    comment: 'Green border accent',
    style: { borderColor: 'green' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const BorderColorAmber: Story = {
  args: {
    comment: 'Amber border accent',
    style: { borderColor: 'amber' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const BorderColorPurple: Story = {
  args: {
    comment: 'Purple border accent',
    style: { borderColor: 'purple' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const BorderColorRose: Story = {
  args: {
    comment: 'Rose border accent',
    style: { borderColor: 'rose' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const BorderColorCyan: Story = {
  args: {
    comment: 'Cyan border accent',
    style: { borderColor: 'cyan' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const BorderColorNeutral: Story = {
  args: {
    comment: 'Neutral border accent',
    style: { borderColor: 'neutral' },
    onClick: () => console.log('Comment clicked'),
  },
}

// ============================================================================
// Background Color Variants
// ============================================================================

export const BackgroundLight: Story = {
  args: {
    comment: 'Light background',
    style: { backgroundColor: 'light' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const BackgroundTinted: Story = {
  args: {
    comment: 'Tinted background (primary color)',
    style: { backgroundColor: 'tinted' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const BackgroundNone: Story = {
  args: {
    comment: 'Transparent background',
    style: { backgroundColor: 'none' },
    onClick: () => console.log('Comment clicked'),
  },
}

// ============================================================================
// Font Size Variants
// ============================================================================

export const FontSizeSmall: Story = {
  args: {
    comment: 'Small text size (default)',
    style: { fontSize: 'sm' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const FontSizeBase: Story = {
  args: {
    comment: 'Base text size',
    style: { fontSize: 'base' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const FontSizeLarge: Story = {
  args: {
    comment: 'Large text size',
    style: { fontSize: 'lg' },
    onClick: () => console.log('Comment clicked'),
  },
}

// ============================================================================
// Font Weight Variants
// ============================================================================

export const FontWeightMedium: Story = {
  args: {
    comment: 'Medium font weight',
    style: { fontWeight: 'medium' },
    onClick: () => console.log('Comment clicked'),
  },
}

export const FontWeightSemibold: Story = {
  args: {
    comment: 'Semibold font weight',
    style: { fontWeight: 'semibold' },
    onClick: () => console.log('Comment clicked'),
  },
}

// ============================================================================
// Combined Style Examples
// ============================================================================

/**
 * Emphasis style with blue border and semibold text
 */
export const EmphasisStyle: Story = {
  args: {
    comment: '重要：来週リリース予定',
    style: {
      borderColor: 'blue',
      backgroundColor: 'tinted',
      fontSize: 'base',
      fontWeight: 'semibold',
    },
    onClick: () => console.log('Comment clicked'),
  },
}

/**
 * Subtle style with neutral colors
 */
export const SubtleStyle: Story = {
  args: {
    comment: 'メモ：後で確認する',
    style: {
      borderColor: 'neutral',
      backgroundColor: 'none',
      fontSize: 'sm',
      fontWeight: 'normal',
    },
    onClick: () => console.log('Comment clicked'),
  },
}

/**
 * Warning style with amber colors
 */
export const WarningStyle: Story = {
  args: {
    comment: '⚠️ 要注意：破壊的変更あり',
    style: {
      borderColor: 'amber',
      backgroundColor: 'light',
      fontSize: 'base',
      fontWeight: 'medium',
    },
    onClick: () => console.log('Comment clicked'),
  },
}

// ============================================================================
// All Border Colors Showcase
// ============================================================================

/**
 * Showcase all available border colors
 */
export const AllBorderColors: Story = {
  args: {
    comment: 'Showcase',
  },
  render: () => (
    <div className="space-y-3">
      {(
        Object.keys(COMMENT_BORDER_COLORS) as Array<
          keyof typeof COMMENT_BORDER_COLORS
        >
      ).map((color) => (
        <CommentDisplay
          key={color}
          comment={`Border: ${color}`}
          style={{ borderColor: color }}
          onClick={() => console.log(`Clicked: ${color}`)}
        />
      ))}
    </div>
  ),
}

/**
 * Showcase all available background colors
 */
export const AllBackgroundColors: Story = {
  args: {
    comment: 'Showcase',
  },
  render: () => (
    <div className="space-y-3">
      {(
        Object.keys(COMMENT_BG_COLORS) as Array<keyof typeof COMMENT_BG_COLORS>
      ).map((bg) => (
        <CommentDisplay
          key={bg}
          comment={`Background: ${bg}`}
          style={{ backgroundColor: bg }}
          onClick={() => console.log(`Clicked: ${bg}`)}
        />
      ))}
    </div>
  ),
}

/**
 * Showcase all font sizes
 */
export const AllFontSizes: Story = {
  args: {
    comment: 'Showcase',
  },
  render: () => (
    <div className="space-y-3">
      {(
        Object.keys(COMMENT_FONT_SIZES) as Array<
          keyof typeof COMMENT_FONT_SIZES
        >
      ).map((size) => (
        <CommentDisplay
          key={size}
          comment={`Font size: ${size}`}
          style={{ fontSize: size }}
          onClick={() => console.log(`Clicked: ${size}`)}
        />
      ))}
    </div>
  ),
}

/**
 * Showcase all font weights
 */
export const AllFontWeights: Story = {
  args: {
    comment: 'Showcase',
  },
  render: () => (
    <div className="space-y-3">
      {(
        Object.keys(COMMENT_FONT_WEIGHTS) as Array<
          keyof typeof COMMENT_FONT_WEIGHTS
        >
      ).map((weight) => (
        <CommentDisplay
          key={weight}
          comment={`Font weight: ${weight}`}
          style={{ fontWeight: weight }}
          onClick={() => console.log(`Clicked: ${weight}`)}
        />
      ))}
    </div>
  ),
}
