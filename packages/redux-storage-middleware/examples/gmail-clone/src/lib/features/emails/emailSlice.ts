/**
 * Email Slice for Gmail Clone
 *
 * Manages email state with localStorage persistence via redux-storage-middleware
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

// ============================================================================
// Types
// ============================================================================

export interface Email {
  id: string
  from: string
  to: string
  subject: string
  body: string
  preview: string
  timestamp: string
  read: boolean
  starred: boolean
  labels: string[]
  hasAttachment: boolean
}

export interface EmailsState {
  emails: Email[]
  selectedId: string | null
  searchQuery: string
  currentLabel: string
  isLoading: boolean
  lastSyncTime: string | null
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: EmailsState = {
  emails: [],
  selectedId: null,
  searchQuery: '',
  currentLabel: 'inbox',
  isLoading: false,
  lastSyncTime: null,
}

// ============================================================================
// Mock Data Generator (1000+ emails)
// ============================================================================

const senders = [
  'john.doe@company.com',
  'jane.smith@startup.io',
  'noreply@github.com',
  'support@stripe.com',
  'team@slack.com',
  'notifications@twitter.com',
  'hello@vercel.com',
  'updates@npm.org',
  'security@google.com',
  'newsletter@medium.com',
]

const subjects = [
  'Re: Project Update - Q4 Review',
  '[GitHub] Pull request merged',
  'Your invoice is ready',
  'Weekly digest: Top stories',
  'Security alert: New sign-in',
  'Meeting reminder: Tomorrow at 3pm',
  'Invitation to collaborate',
  'Your order has shipped',
  'Action required: Verify your email',
  'New comment on your post',
]

const bodyTemplates = [
  'Hi there,\n\nI wanted to follow up on our discussion from last week. We have made significant progress on the project and I think we are ready for the next phase.\n\nBest regards,\n{sender}',
  'Dear valued customer,\n\nThank you for your continued support. We are excited to announce new features that will help improve your workflow.\n\nThe team at {company}',
  'This is an automated notification. Your action was completed successfully. Please review the details in your dashboard.\n\nNo reply is necessary.',
  'Greetings!\n\nWe noticed some unusual activity on your account. Please verify this was you by clicking the link below.\n\nStay safe,\nSecurity Team',
  'Hello,\n\nYour weekly summary is ready! Check out the highlights from the past 7 days:\n- 15 new followers\n- 42 post views\n- 8 new comments\n\nKeep up the great work!',
]

const labels = ['inbox', 'work', 'personal', 'promotions', 'social', 'updates']

/**
 * Generate a random email
 */
function generateEmail(index: number): Email {
  const sender = senders[index % senders.length]
  const subject = subjects[index % subjects.length]
  const bodyTemplate = bodyTemplates[index % bodyTemplates.length]
  const body = bodyTemplate
    .replace('{sender}', sender.split('@')[0])
    .replace('{company}', sender.split('@')[1])

  // Generate timestamp within the last 30 days
  const daysAgo = Math.floor(Math.random() * 30)
  const hoursAgo = Math.floor(Math.random() * 24)
  const timestamp = new Date(
    Date.now() - daysAgo * 86400000 - hoursAgo * 3600000,
  ).toISOString()

  return {
    id: `email-${index.toString().padStart(6, '0')}`,
    from: sender,
    to: 'me@gmail.com',
    subject: `${subject} #${index}`,
    body,
    preview: body.substring(0, 100).replace(/\n/g, ' ') + '...',
    timestamp,
    read: Math.random() > 0.3,
    starred: Math.random() > 0.8,
    labels: [labels[index % labels.length]],
    hasAttachment: Math.random() > 0.7,
  }
}

/**
 * Generate N emails for testing
 */
export function generateMockEmails(count: number): Email[] {
  const emails: Email[] = []
  for (let i = 0; i < count; i++) {
    emails.push(generateEmail(i))
  }
  return emails.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

// ============================================================================
// Slice
// ============================================================================

const emailSlice = createSlice({
  name: 'emails',
  initialState,
  reducers: {
    // Load emails (e.g., mock data)
    loadEmails: (state, action: PayloadAction<Email[]>) => {
      state.emails = action.payload
      state.lastSyncTime = new Date().toISOString()
    },

    // Add a single email
    addEmail: (state, action: PayloadAction<Email>) => {
      state.emails.unshift(action.payload)
    },

    // Select an email
    selectEmail: (state, action: PayloadAction<string | null>) => {
      state.selectedId = action.payload
      if (action.payload) {
        const email = state.emails.find((e) => e.id === action.payload)
        if (email) {
          email.read = true
        }
      }
    },

    // Mark email as read/unread
    markAsRead: (
      state,
      action: PayloadAction<{ id: string; read: boolean }>,
    ) => {
      const email = state.emails.find((e) => e.id === action.payload.id)
      if (email) {
        email.read = action.payload.read
      }
    },

    // Toggle star
    toggleStar: (state, action: PayloadAction<string>) => {
      const email = state.emails.find((e) => e.id === action.payload)
      if (email) {
        email.starred = !email.starred
      }
    },

    // Delete email
    deleteEmail: (state, action: PayloadAction<string>) => {
      state.emails = state.emails.filter((e) => e.id !== action.payload)
      if (state.selectedId === action.payload) {
        state.selectedId = null
      }
    },

    // Search
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
    },

    // Change label
    setCurrentLabel: (state, action: PayloadAction<string>) => {
      state.currentLabel = action.payload
      state.selectedId = null
    },

    // Bulk operations
    markAllAsRead: (state) => {
      state.emails.forEach((email) => {
        email.read = true
      })
    },

    // Clear all emails
    clearAllEmails: (state) => {
      state.emails = []
      state.selectedId = null
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
  },
})

export const {
  loadEmails,
  addEmail,
  selectEmail,
  markAsRead,
  toggleStar,
  deleteEmail,
  setSearchQuery,
  setCurrentLabel,
  markAllAsRead,
  clearAllEmails,
  setLoading,
} = emailSlice.actions

export default emailSlice.reducer

// ============================================================================
// Selectors
// ============================================================================

export const selectAllEmails = (state: { emails: EmailsState }) =>
  state.emails.emails

export const selectFilteredEmails = (state: { emails: EmailsState }) => {
  const { emails, searchQuery, currentLabel } = state.emails

  return emails.filter((email) => {
    // Filter by label
    if (currentLabel !== 'all' && !email.labels.includes(currentLabel)) {
      return false
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        email.subject.toLowerCase().includes(query) ||
        email.from.toLowerCase().includes(query) ||
        email.body.toLowerCase().includes(query)
      )
    }

    return true
  })
}

export const selectSelectedEmail = (state: { emails: EmailsState }) => {
  const { emails, selectedId } = state.emails
  return emails.find((e) => e.id === selectedId) ?? null
}

export const selectEmailStats = (state: { emails: EmailsState }) => {
  const { emails } = state.emails
  return {
    total: emails.length,
    unread: emails.filter((e) => !e.read).length,
    starred: emails.filter((e) => e.starred).length,
  }
}
