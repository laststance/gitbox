/**
 * ProjectInfoModal Component Stories
 *
 * A modal dialog for editing project information including quick notes,
 * links (production, tracking, Supabase), and credentials management.
 * Supports three credential patterns: Reference (URL only), Encrypted (AES-256-GCM),
 * and External (1Password/Bitwarden). Features automatic masking of sensitive data
 * and WCAG AA accessibility compliance.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ProjectInfoModal } from './ProjectInfoModal'

const meta = {
  title: 'Modals/ProjectInfoModal',
  component: ProjectInfoModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProjectInfoModal>

export default meta
type Story = StoryObj<typeof meta>

const mockProjectInfo = {
  id: 'project-1',
  quickNote: 'This is a quick note about the project',
  links: [
    {
      type: 'production' as const,
      url: 'https://example.com',
    },
    {
      type: 'tracking' as const,
      url: 'https://tracking.example.com',
    },
  ],
  credentials: [
    {
      id: 'cred-1',
      type: 'reference' as const,
      name: 'Admin Dashboard',
      reference: 'https://admin.example.com',
    },
  ],
}

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: (data) => {
      console.log('Saved:', data)
    },
    projectInfo: mockProjectInfo,
  },
}

export const Empty: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: (data) => {
      console.log('Saved:', data)
    },
    projectInfo: {
      id: 'project-2',
      quickNote: '',
      links: [],
      credentials: [],
    },
  },
}

export const WithAllLinks: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: (data) => {
      console.log('Saved:', data)
    },
    projectInfo: {
      ...mockProjectInfo,
      links: [
        {
          type: 'production' as const,
          url: 'https://production.example.com',
        },
        {
          type: 'tracking' as const,
          url: 'https://tracking.example.com',
        },
        {
          type: 'supabase' as const,
          url: 'https://supabase.example.com',
        },
      ],
    },
  },
}

export const WithEncryptedCredentials: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: (data) => {
      console.log('Saved:', data)
    },
    projectInfo: {
      ...mockProjectInfo,
      credentials: [
        {
          id: 'cred-1',
          type: 'encrypted' as const,
          name: 'API Key',
          encryptedValue: 'encrypted-value-here',
        },
      ],
    },
  },
}

export const WithExternalCredentials: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: (data) => {
      console.log('Saved:', data)
    },
    projectInfo: {
      ...mockProjectInfo,
      credentials: [
        {
          id: 'cred-1',
          type: 'external' as const,
          name: 'Database Password',
          location: '1Password: GitBox/Database',
        },
      ],
    },
  },
}

export const WithLongQuickNote: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Modal closed'),
    onSave: (data) => {
      console.log('Saved:', data)
    },
    projectInfo: {
      ...mockProjectInfo,
      quickNote:
        'This is a very long quick note that approaches the 300 character limit. '.repeat(
          4,
        ),
    },
  },
}
