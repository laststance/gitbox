/**
 * PublicBoardClient Component Stories
 *
 * Tests the read-only public board view:
 * - Default board with columns and cards
 * - Empty board with columns but no cards
 * - Board with subtitle displayed
 * - Board with many cards across multiple columns
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { PublicBoardClient } from './PublicBoardClient'

const meta = {
  title: 'Pages/PublicBoardClient',
  component: PublicBoardClient,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PublicBoardClient>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default board with 2 columns and 3 cards
 */
export const Default: Story = {
  args: {
    data: {
      board: {
        id: 'board-1',
        name: 'My Public Board',
        subtitle: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-06-01T00:00:00.000Z',
        is_public: true,
        share_slug: 'a1b2c3d4e5f6',
        settings: null,
      },
      statusLists: [
        {
          id: 'status-1',
          title: 'To Do',
          color: '#ef4444',
          gridRow: 0,
          gridCol: 0,
          boardId: 'board-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'status-2',
          title: 'Done',
          color: '#22c55e',
          gridRow: 0,
          gridCol: 1,
          boardId: 'board-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      repoCards: [
        {
          id: 'card-1',
          title: 'react',
          repoOwner: 'facebook',
          repoName: 'react',
          description:
            'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
          statusId: 'status-1',
          boardId: 'board-1',
          order: 0,
          meta: { stars: 220000, language: 'JavaScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-2',
          title: 'next.js',
          repoOwner: 'vercel',
          repoName: 'next.js',
          description: 'The React Framework for the Web.',
          statusId: 'status-1',
          boardId: 'board-1',
          order: 1,
          meta: { stars: 125000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-3',
          title: 'redux-toolkit',
          repoOwner: 'reduxjs',
          repoName: 'redux-toolkit',
          description:
            'The official, opinionated, batteries-included toolset for efficient Redux development.',
          statusId: 'status-2',
          boardId: 'board-1',
          order: 0,
          meta: { stars: 10500, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(
      () => {
        expect(canvas.getByText('My Public Board')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    expect(canvas.getByText('Public')).toBeInTheDocument()
    expect(canvas.getByText('react')).toBeInTheDocument()
    expect(canvas.getByText('next.js')).toBeInTheDocument()
    expect(canvas.getByText('redux-toolkit')).toBeInTheDocument()
  },
}

/**
 * Empty board with columns but no cards
 */
export const EmptyBoard: Story = {
  args: {
    data: {
      board: {
        id: 'board-2',
        name: 'Empty Board',
        subtitle: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        is_public: true,
        share_slug: 'b2c3d4e5f6a7',
        settings: null,
      },
      statusLists: [
        {
          id: 'status-3',
          title: 'Backlog',
          color: '#6b7280',
          gridRow: 0,
          gridCol: 0,
          boardId: 'board-2',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'status-4',
          title: 'In Progress',
          color: '#3b82f6',
          gridRow: 0,
          gridCol: 1,
          boardId: 'board-2',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      repoCards: [],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(
      () => {
        expect(canvas.getByText('Empty Board')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    // Column headers visible
    expect(canvas.getByText('Backlog')).toBeInTheDocument()
    expect(canvas.getByText('In Progress')).toBeInTheDocument()

    // No card links rendered (GitHub repo links use <a> with external-link icon)
    const repoLinks = canvasElement.querySelectorAll(
      'a[target="_blank"][href^="https://github.com/"]',
    )
    expect(repoLinks.length).toBe(0)
  },
}

/**
 * Board with subtitle displayed below the title
 */
export const WithSubtitle: Story = {
  args: {
    data: {
      board: {
        id: 'board-3',
        name: 'Project Tracker',
        subtitle: 'This is a shared project board',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-06-01T00:00:00.000Z',
        is_public: true,
        share_slug: 'c3d4e5f6a7b8',
        settings: null,
      },
      statusLists: [
        {
          id: 'status-5',
          title: 'To Do',
          color: '#ef4444',
          gridRow: 0,
          gridCol: 0,
          boardId: 'board-3',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      repoCards: [
        {
          id: 'card-4',
          title: 'typescript',
          repoOwner: 'microsoft',
          repoName: 'TypeScript',
          description:
            'TypeScript is a superset of JavaScript that compiles to clean JavaScript output.',
          statusId: 'status-5',
          boardId: 'board-3',
          order: 0,
          meta: { stars: 100000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(
      () => {
        expect(canvas.getByText('Project Tracker')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    expect(
      canvas.getByText('This is a shared project board'),
    ).toBeInTheDocument()
  },
}

/**
 * Board with 3 columns and 10 cards to verify scrollable layout
 */
export const ManyCards: Story = {
  args: {
    data: {
      board: {
        id: 'board-4',
        name: 'Large Board',
        subtitle: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-06-01T00:00:00.000Z',
        is_public: true,
        share_slug: 'd4e5f6a7b8c9',
        settings: null,
      },
      statusLists: [
        {
          id: 'status-6',
          title: 'Backlog',
          color: '#6b7280',
          gridRow: 0,
          gridCol: 0,
          boardId: 'board-4',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'status-7',
          title: 'In Progress',
          color: '#3b82f6',
          gridRow: 0,
          gridCol: 1,
          boardId: 'board-4',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'status-8',
          title: 'Done',
          color: '#22c55e',
          gridRow: 0,
          gridCol: 2,
          boardId: 'board-4',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      repoCards: [
        {
          id: 'card-10',
          title: 'react',
          repoOwner: 'facebook',
          repoName: 'react',
          description: 'A declarative UI library.',
          statusId: 'status-6',
          boardId: 'board-4',
          order: 0,
          meta: { stars: 220000, language: 'JavaScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-11',
          title: 'vue',
          repoOwner: 'vuejs',
          repoName: 'core',
          description: 'The progressive JavaScript framework.',
          statusId: 'status-6',
          boardId: 'board-4',
          order: 1,
          meta: { stars: 46000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-12',
          title: 'angular',
          repoOwner: 'angular',
          repoName: 'angular',
          description: 'One framework. Mobile & desktop.',
          statusId: 'status-6',
          boardId: 'board-4',
          order: 2,
          meta: { stars: 95000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-13',
          title: 'svelte',
          repoOwner: 'sveltejs',
          repoName: 'svelte',
          description: 'Cybernetically enhanced web apps.',
          statusId: 'status-6',
          boardId: 'board-4',
          order: 3,
          meta: { stars: 78000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-14',
          title: 'next.js',
          repoOwner: 'vercel',
          repoName: 'next.js',
          description: 'The React Framework.',
          statusId: 'status-7',
          boardId: 'board-4',
          order: 0,
          meta: { stars: 125000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-15',
          title: 'nuxt',
          repoOwner: 'nuxt',
          repoName: 'nuxt',
          description: 'The Intuitive Vue Framework.',
          statusId: 'status-7',
          boardId: 'board-4',
          order: 1,
          meta: { stars: 53000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-16',
          title: 'remix',
          repoOwner: 'remix-run',
          repoName: 'remix',
          description: 'Build better websites.',
          statusId: 'status-7',
          boardId: 'board-4',
          order: 2,
          meta: { stars: 29000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-17',
          title: 'astro',
          repoOwner: 'withastro',
          repoName: 'astro',
          description: 'The web framework for content-driven websites.',
          statusId: 'status-8',
          boardId: 'board-4',
          order: 0,
          meta: { stars: 44000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-18',
          title: 'solid',
          repoOwner: 'solidjs',
          repoName: 'solid',
          description:
            'A declarative, efficient, and flexible JavaScript library.',
          statusId: 'status-8',
          boardId: 'board-4',
          order: 1,
          meta: { stars: 32000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-19',
          title: 'qwik',
          repoOwner: 'QwikDev',
          repoName: 'qwik',
          description: 'Instant-loading web apps without effort.',
          statusId: 'status-8',
          boardId: 'board-4',
          order: 2,
          meta: { stars: 20000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(
      () => {
        expect(canvas.getByText('Large Board')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    // All 3 columns visible
    expect(canvas.getByText('Backlog')).toBeInTheDocument()
    expect(canvas.getByText('In Progress')).toBeInTheDocument()
    expect(canvas.getByText('Done')).toBeInTheDocument()

    // Verify all 10 card titles rendered
    const repoLinks = canvasElement.querySelectorAll(
      'a[target="_blank"][href^="https://github.com/"]',
    )
    expect(repoLinks.length).toBe(10)
  },
}
