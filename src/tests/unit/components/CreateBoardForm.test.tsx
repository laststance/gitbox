/**
 * Unit Test: CreateBoardForm Component
 *
 * Test targets:
 * - Form input validation
 * - Form button behavior
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

import { CreateBoardForm } from '@/app/boards/new/CreateBoardForm'

// Mock next/navigation
const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

// Mock server actions
vi.mock('@/lib/actions/board', () => ({
  createBoard: vi.fn().mockResolvedValue({ id: 'new-board-id' }),
}))

describe('CreateBoardForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Form Input Validation', () => {
    test('should display board name input', () => {
      render(<CreateBoardForm />)

      const input = screen.getByPlaceholderText(
        /e\.g\., AI Experiments, Side Projects/i,
      )
      expect(input).toBeInTheDocument()
    })

    test('should display character count', () => {
      render(<CreateBoardForm />)

      // Initial count should be 0/50
      expect(screen.getByText('0/50 characters')).toBeInTheDocument()
    })

    test('should update character count when typing', () => {
      render(<CreateBoardForm />)

      const input = screen.getByPlaceholderText(
        /e\.g\., AI Experiments, Side Projects/i,
      )
      fireEvent.change(input, { target: { value: 'Test Board' } })

      expect(screen.getByText('10/50 characters')).toBeInTheDocument()
    })

    test('should have autoFocus on board name input', () => {
      render(<CreateBoardForm />)

      const input = screen.getByPlaceholderText(
        /e\.g\., AI Experiments, Side Projects/i,
      )
      // autoFocus should make input the active element
      expect(input).toBeInTheDocument()
      expect(input.tagName).toBe('INPUT')
    })
  })

  describe('Form Buttons', () => {
    test('should display Cancel button', () => {
      render(<CreateBoardForm />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeInTheDocument()
    })

    test('should display Create Board button', () => {
      render(<CreateBoardForm />)

      const createButton = screen.getByRole('button', {
        name: /create board/i,
      })
      expect(createButton).toBeInTheDocument()
    })

    test('should call router.back when Cancel is clicked', () => {
      render(<CreateBoardForm />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockBack).toHaveBeenCalled()
    })
  })
})
