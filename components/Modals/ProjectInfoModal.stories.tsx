/**
 * Storybook: ProjectInfoModal Component
 *
 * Constitution要件: Principle III - コンポーネント文書化必須
 *
 * User Story 4のすべてのシナリオをカバー:
 * - Closed: モーダル閉じた状態
 * - EmptyState: 空の状態
 * - WithQuickNote: Quick note入力済み
 * - WithSingleURL: Production URL 1つ
 * - WithMultipleURLs: 異なるタイプの複数URL
 * - URLValidationError: URLバリデーションエラー
 * - CompleteForm: すべて入力済み
 * - NearCharLimit: 文字数制限警告 (290文字以上)
 * - CharLimitReached: 文字数制限到達 (300文字)
 * - DarkMode: ダークモード表示
 * - AccessibilityTest: WCAG AA準拠確認
 *
 * User Story 5のCredentials機能をカバー:
 * - CredentialsPatternA: 参照リンク (ダッシュボードURL)
 * - CredentialsPatternB: 暗号化保存 (AES-256-GCM、マスク表示)
 * - CredentialsPatternC: 外部管理 (1Password/Bitwarden)
 * - CredentialsAllPatterns: 全パターン混在
 * - CredentialsMaskedDisplay: マスク表示とReveal機能デモ
 */

import type { Meta, StoryObj } from '@storybook/react';
import { ProjectInfoModal, type ProjectInfo } from './ProjectInfoModal';
import { fn } from '@storybook/test';

const meta = {
  title: 'Modals/ProjectInfoModal',
  component: ProjectInfoModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'プロジェクト情報を管理するモーダル。Quick note (1-3行、300文字制限) と関連リンク (Production、Tracking、Supabase) を保存できます。\n\n**US4 機能:**\n- Quick noteの入力 (1-3行、300文字制限)\n- Production/Tracking/Supabase URLの追加・削除\n- URLバリデーション\n- キーボードナビゲーション (Tab, Enter, ESC)\n- WCAG AA準拠',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'モーダルの開閉状態',
    },
    onClose: {
      action: 'closed',
      description: 'モーダルを閉じる時のコールバック',
    },
    onSave: {
      action: 'saved',
      description: 'データを保存する時のコールバック',
    },
    projectInfo: {
      control: 'object',
      description: 'プロジェクト情報の初期データ',
    },
  },
} satisfies Meta<typeof ProjectInfoModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper: 空のprojectInfo
const emptyProjectInfo: ProjectInfo = {
  id: '00000000-0000-0000-0000-000000000001',
  quickNote: '',
  links: [],
};

/**
 * モーダル閉じた状態
 *
 * デフォルト状態。isOpenをtrueにすると開きます。
 */
export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: fn(),
    onSave: fn(),
    projectInfo: emptyProjectInfo,
  },
};

/**
 * 空の状態（モーダル開いた）
 *
 * US4 Scenario 1: Overflow menuから"Edit Project Info"選択してモーダル表示した状態。
 * Quick noteもリンクも空の初期状態です。
 */
export const EmptyState: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: emptyProjectInfo,
  },
  parameters: {
    docs: {
      description: {
        story:
          'プロジェクト情報が空の状態。Quick noteに1-3行のメモを入力でき、Add URLボタンでリンクを追加できます。',
      },
    },
  },
};

/**
 * Quick note入力済み
 *
 * US4 Scenario 2: Quick noteセクションにメモを入力した状態。
 * 文字数カウンター (61 / 300) が表示されます。
 */
export const WithQuickNote: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote: 'This is a test project\nMain production app\nDeployed on Vercel',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Quick noteに3行のメモが入力された状態。文字数は300文字まで入力可能で、カウンターで残り文字数を確認できます。',
      },
    },
  },
};

/**
 * Production URL 1つ
 *
 * US4 Scenario 3: Production URLを1つ追加した状態。
 * URLが有効な場合、ドメイン名がリンクとして表示されます。
 */
export const WithSingleURL: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      links: [{ url: 'https://gitbox.vercel.app', type: 'production' }],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Production URLが1つ追加された状態。有効なURLの場合、ドメイン名 (gitbox.vercel.app) がリンクとして表示されます。',
      },
    },
  },
};

/**
 * 複数URL (異なるtype)
 *
 * US4 Scenario 3, 4, 5: Production、Tracking、Supabaseの3種類のURLが追加された状態。
 * 各URLタイプに応じてSelectで分類できます。
 */
export const WithMultipleURLs: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      links: [
        { url: 'https://gitbox.vercel.app', type: 'production' },
        { url: 'https://analytics.google.com/dashboard', type: 'tracking' },
        {
          url: 'https://app.supabase.com/project/abc123/editor',
          type: 'supabase',
        },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          '複数のURLが異なるタイプで追加された状態。Production (本番環境)、Tracking (分析ツール)、Supabase (データベース) の3種類のリンクを管理できます。新しいタブで開くことができます。',
      },
    },
  },
};

/**
 * URLバリデーションエラー
 *
 * US4 Validation Test: 無効なURLを入力した際のエラー表示。
 * "Please enter a valid URL" メッセージが表示され、Saveボタンが無効化されます。
 */
export const URLValidationError: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      links: [{ url: 'not-a-valid-url', type: 'production' }],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          '無効なURL形式が入力された状態。エラーメッセージ "Please enter a valid URL" が表示され、Saveボタンが無効化されます。有効なURLはhttps://またはhttp://で始まる必要があります。',
      },
    },
  },
};

/**
 * すべて入力済み (Complete Form)
 *
 * US4 Complete Scenario: Quick noteと複数のURLがすべて入力された状態。
 * 保存可能な状態で、Saveボタンが有効化されています。
 */
export const CompleteForm: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote:
        'Full-stack PWA for GitHub repository management\nBuilt with Next.js 16, React 19, Supabase\nDeployed: Vercel (Production)',
      links: [
        { url: 'https://gitbox.vercel.app', type: 'production' },
        {
          url: 'https://analytics.google.com/analytics/gitbox',
          type: 'tracking',
        },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'すべてのフィールドが入力された完全な状態。Quick noteとProductionおよびTrackingのURLが設定されています。保存可能な状態です。',
      },
    },
  },
};

/**
 * 文字数制限警告
 *
 * Quick noteが290文字以上入力された際の警告状態。
 * 文字数カウンターが警告色（オレンジ）に変わります。
 */
export const NearCharLimit: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur.',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          '文字数制限 (300文字) に近い状態 (290文字以上)。カウンターが警告色 (text-warning) に変わり、残り文字数が少ないことを視覚的に通知します。',
      },
    },
  },
};

/**
 * 文字数制限到達
 *
 * Quick noteが300文字ちょうど入力された状態。
 * これ以上入力できません。
 */
export const CharLimitReached: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat.',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          '文字数制限 (300文字) に到達した状態。これ以上入力できず、カウンターは "300 / 300" を表示します。',
      },
    },
  },
};

/**
 * Dark Mode
 *
 * ダークモードでのモーダル表示。
 * すべてのテーマで適切にスタイリングされます。
 */
export const DarkMode: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote:
        'Full-stack PWA for GitHub repository management\nBuilt with Next.js 16, React 19, Supabase',
      links: [
        { url: 'https://gitbox.vercel.app', type: 'production' },
        { url: 'https://analytics.google.com/dashboard', type: 'tracking' },
      ],
    },
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
 * Accessibility Test (WCAG AA準拠確認)
 *
 * Constitution Principle IV: WCAG AA準拠確認用のストーリー。
 *
 * テスト項目:
 * - キーボードナビゲーション (Tab, Enter, ESC)
 * - フォーカス管理 (autoFocus on Quick note)
 * - ARIA属性 (aria-labelledby, aria-describedby, aria-invalid)
 * - コントラスト比 (4.5:1 テキスト、3:1 UI要素)
 * - スクリーンリーダー対応 (role="alert" for errors)
 */
export const AccessibilityTest: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote: 'Accessibility testing project',
      links: [{ url: 'not-a-valid-url', type: 'production' }], // Error state for testing
    },
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
          {
            id: 'label',
            enabled: true,
          },
          {
            id: 'aria-valid-attr',
            enabled: true,
          },
        ],
      },
    },
    docs: {
      description: {
        story:
          'アクセシビリティテスト用。WCAG AA準拠を確認します。エラー状態を含めて、キーボードナビゲーション、フォーカス管理、ARIA属性、コントラスト比をテストします。',
      },
    },
  },
};

/**
 * US5: Pattern A - Reference (参照リンク)
 *
 * 認証情報をダッシュボードURLで管理するパターン。
 * Stripe Dashboard、AWS Consoleなどの外部ダッシュボードへのリンクを保存します。
 */
export const CredentialsPatternA: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote: 'Pattern A: Reference links to external dashboards',
      credentials: [
        {
          type: 'reference',
          name: 'Stripe Dashboard',
          reference: 'https://dashboard.stripe.com',
          note: 'Production API keys',
        },
        {
          type: 'reference',
          name: 'AWS Console',
          reference: 'https://console.aws.amazon.com',
          note: 'Main account credentials',
        },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pattern A: ダッシュボードURLのみを保存する参照リンク方式。認証情報そのものは保存せず、外部サービスのダッシュボードへのアクセス先のみを管理します。',
      },
    },
  },
};

/**
 * US5: Pattern B - Encrypted (暗号化保存)
 *
 * AES-256-GCMで暗号化して保存するパターン。
 * デフォルトでマスク表示 (例: sk_live_*****wM5N8)。
 * Revealボタンで30秒間のみ実際の値を表示できます。
 */
export const CredentialsPatternB: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote:
        'Pattern B: Encrypted credentials with AES-256-GCM\nMasked display with 30-second auto-hide timer',
      credentials: [
        {
          type: 'encrypted',
          name: 'Stripe API Key',
          encrypted_value: 'sk_live_51H4RdE2BqJhGwM5N8XyZ123',
          masked_display: 'sk_live_*****5N8XyZ123',
          note: 'Production live key',
        },
        {
          type: 'encrypted',
          name: 'GitHub Personal Access Token',
          encrypted_value: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
          masked_display: 'ghp_*****wxyz',
          note: 'Repository access token',
        },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pattern B: AES-256-GCMで暗号化して保存。デフォルトでマスク表示 (prefix_*****suffix) され、Eyeアイコンをクリックすると30秒間のみ実際の値を表示します。30秒経過後は自動的にマスクに戻ります。',
      },
    },
  },
};

/**
 * US5: Pattern C - External (外部管理)
 *
 * 1PasswordやBitwardenなどのパスワードマネージャーで管理するパターン。
 * 認証情報の保存場所のみを記録します。
 */
export const CredentialsPatternC: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote: 'Pattern C: External password manager references',
      credentials: [
        {
          type: 'external',
          name: 'Production Database',
          location: '1Password > Team Vault > Production Credentials',
          note: 'PostgreSQL admin password',
        },
        {
          type: 'external',
          name: 'SSH Private Key',
          location: 'Bitwarden > Shared > Server Access Keys',
          note: 'EC2 instance access',
        },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pattern C: 1PasswordやBitwardenなどのパスワードマネージャーで管理。認証情報そのものは保存せず、保存場所のパス (例: "1Password > Team Vault > Production") のみを記録します。',
      },
    },
  },
};

/**
 * US5: All Patterns Mixed (全パターン混在)
 *
 * 3つの認証情報パターンとリンクが混在した実際の使用例。
 * Quick note、Links、Credentialsすべてを組み合わせた状態です。
 */
export const CredentialsAllPatterns: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote:
        'Full-stack PWA with comprehensive credential management\nSupports 3 security patterns for different use cases',
      links: [
        { url: 'https://gitbox.vercel.app', type: 'production' },
        {
          url: 'https://analytics.google.com/analytics/gitbox',
          type: 'tracking',
        },
        {
          url: 'https://app.supabase.com/project/abc123',
          type: 'supabase',
        },
      ],
      credentials: [
        {
          type: 'reference',
          name: 'Stripe Dashboard',
          reference: 'https://dashboard.stripe.com',
          note: 'Payment processing',
        },
        {
          type: 'encrypted',
          name: 'Supabase Service Role Key',
          encrypted_value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.1234567890',
          masked_display: '*****7890',
          note: 'Encrypted with AES-256-GCM',
        },
        {
          type: 'external',
          name: 'Database Master Password',
          location: '1Password > Production > Supabase Admin',
          note: 'PostgreSQL superuser',
        },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          '実際の使用例: Quick note、Links、Credentials (3パターン混在) をすべて組み合わせた状態。Pattern A (参照)、Pattern B (暗号化)、Pattern C (外部管理) を同時に使用できます。',
      },
    },
  },
};

/**
 * US5: Masked Display Demo (マスク表示デモ)
 *
 * マスク表示とReveal機能の動作確認用。
 * 様々な形式のAPIキー/トークンのマスク表示パターンをデモします。
 */
export const CredentialsMaskedDisplay: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onSave: fn(),
    projectInfo: {
      ...emptyProjectInfo,
      quickNote:
        'Masked display patterns for various credential types\nReveal button shows value for 30 seconds',
      credentials: [
        {
          type: 'encrypted',
          name: 'Stripe Live Key (5-char suffix)',
          encrypted_value: 'sk_live_51H4RdE2BqJhGwM5N8',
          masked_display: 'sk_live_*****wM5N8',
          note: 'Stripe keys show 5 characters',
        },
        {
          type: 'encrypted',
          name: 'GitHub Token (4-char suffix)',
          encrypted_value: 'ghp_1234567890abcdefABCDEF',
          masked_display: 'ghp_*****CDEF',
          note: 'GitHub tokens show last 4 chars',
        },
        {
          type: 'encrypted',
          name: 'Generic API Key',
          encrypted_value: 'pk_test_abcdefghijklmnop',
          masked_display: 'pk_test_*****mnop',
          note: 'Generic pattern: prefix + ***** + 4 chars',
        },
        {
          type: 'encrypted',
          name: 'Short Value',
          encrypted_value: '1234567',
          masked_display: '*****',
          note: 'Values < 8 chars show only *****',
        },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'マスク表示パターンのデモ: Stripe (5文字)、GitHub (4文字)、汎用パターン、短い値 (8文字未満) のマスク表示を確認できます。Eyeアイコンをクリックすると30秒間実際の値が表示されます。',
      },
    },
  },
};