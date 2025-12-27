/**
 * Unit Test: CreateBoardForm Component
 *
 * Test targets:
 * - Theme selection and preview functionality
 * - Form input validation
 * - Theme preview applies to document (data-theme attribute)
 * - Original theme restoration on unmount
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
    // Reset document state before each test
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    cleanup()
    // Clean up document state after each test
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
  })

  describe('Theme Selection Rendering', () => {
    it('should display light theme options', () => {
      render(<CreateBoardForm />)

      expect(screen.getByText('Default')).toBeInTheDocument()
      expect(screen.getByText('Sunrise')).toBeInTheDocument()
      expect(screen.getByText('Sandstone')).toBeInTheDocument()
      expect(screen.getByText('Mint')).toBeInTheDocument()
      expect(screen.getByText('Sky')).toBeInTheDocument()
      expect(screen.getByText('Lavender')).toBeInTheDocument()
      expect(screen.getByText('Rose')).toBeInTheDocument()
    })

    it('should display dark theme options', () => {
      render(<CreateBoardForm />)

      // "Dark" appears twice (section header + theme button), so we use getAllByText
      const darkElements = screen.getAllByText('Dark')
      expect(darkElements.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Midnight')).toBeInTheDocument()
      expect(screen.getByText('Graphite')).toBeInTheDocument()
      expect(screen.getByText('Forest')).toBeInTheDocument()
      expect(screen.getByText('Ocean')).toBeInTheDocument()
      expect(screen.getByText('Plum')).toBeInTheDocument()
      expect(screen.getByText('Rust')).toBeInTheDocument()
    })

    it('should have Default theme selected by default', () => {
      render(<CreateBoardForm />)

      // Default theme button should have selection styling
      // The button contains text "Default" and has the selected border class
      const defaultButton = screen.getByText('Default').closest('button')
      expect(defaultButton).toHaveClass('border-primary')
    })
  })

  describe('Theme Preview (data-theme attribute)', () => {
    it('should apply default theme to document on mount', () => {
      render(<CreateBoardForm />)

      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'default',
      )
    })

    it('should apply selected theme to document when theme is clicked', () => {
      render(<CreateBoardForm />)

      // Click on Midnight theme
      const midnightButton = screen.getByText('Midnight').closest('button')
      fireEvent.click(midnightButton!)

      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'midnight',
      )
    })

    it('should add dark class for dark themes', () => {
      render(<CreateBoardForm />)

      // Click on Midnight (dark theme)
      const midnightButton = screen.getByText('Midnight').closest('button')
      fireEvent.click(midnightButton!)

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should remove dark class for light themes', () => {
      render(<CreateBoardForm />)

      // First select dark theme
      const midnightButton = screen.getByText('Midnight').closest('button')
      fireEvent.click(midnightButton!)
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      // Then select light theme
      const sunriseButton = screen.getByText('Sunrise').closest('button')
      fireEvent.click(sunriseButton!)

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should apply all 7 light themes correctly', () => {
      render(<CreateBoardForm />)

      const lightThemes = [
        'Default',
        'Sunrise',
        'Sandstone',
        'Mint',
        'Sky',
        'Lavender',
        'Rose',
      ]
      const lightThemeIds = [
        'default',
        'sunrise',
        'sandstone',
        'mint',
        'sky',
        'lavender',
        'rose',
      ]

      lightThemes.forEach((themeName, index) => {
        const button = screen.getByText(themeName).closest('button')
        fireEvent.click(button!)

        expect(document.documentElement.getAttribute('data-theme')).toBe(
          lightThemeIds[index],
        )
        expect(document.documentElement.classList.contains('dark')).toBe(false)
      })
    })

    it('should apply all 7 dark themes correctly', () => {
      render(<CreateBoardForm />)

      const darkThemeIds = [
        'dark',
        'midnight',
        'graphite',
        'forest',
        'ocean',
        'plum',
        'rust',
      ]

      // For "Dark" theme, there are multiple elements, so we need to find the button specifically
      const darkButtons = screen.getAllByText('Dark')
      const darkThemeButton = darkButtons
        .find((el) => el.closest('button'))
        ?.closest('button')
      fireEvent.click(darkThemeButton!)
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      // Other dark themes have unique text
      const otherDarkThemes = [
        'Midnight',
        'Graphite',
        'Forest',
        'Ocean',
        'Plum',
        'Rust',
      ]
      otherDarkThemes.forEach((themeName, index) => {
        const button = screen.getByText(themeName).closest('button')
        fireEvent.click(button!)

        expect(document.documentElement.getAttribute('data-theme')).toBe(
          darkThemeIds[index + 1],
        )
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })
    })
  })

  describe('Theme Restoration on Unmount', () => {
    it('should restore original theme when component unmounts', () => {
      // Set initial theme before mounting
      document.documentElement.setAttribute('data-theme', 'sunrise')
      document.documentElement.classList.remove('dark')

      const { unmount } = render(<CreateBoardForm />)

      // Component should apply default theme
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'default',
      )

      // Select a different theme
      const midnightButton = screen.getByText('Midnight').closest('button')
      fireEvent.click(midnightButton!)
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'midnight',
      )

      // Unmount - should restore original (sunrise)
      unmount()
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'sunrise',
      )
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should restore dark class if original was dark', () => {
      // Set initial dark theme before mounting
      document.documentElement.setAttribute('data-theme', 'midnight')
      document.documentElement.classList.add('dark')

      const { unmount } = render(<CreateBoardForm />)

      // Select a light theme
      const sunriseButton = screen.getByText('Sunrise').closest('button')
      fireEvent.click(sunriseButton!)
      expect(document.documentElement.classList.contains('dark')).toBe(false)

      // Unmount - should restore dark class
      unmount()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('Form Input Validation', () => {
    it('should display board name input', () => {
      render(<CreateBoardForm />)

      const input = screen.getByPlaceholderText(
        /e\.g\., AI Experiments, Side Projects/i,
      )
      expect(input).toBeInTheDocument()
    })

    it('should display character count', () => {
      render(<CreateBoardForm />)

      // Initial count should be 0/50
      expect(screen.getByText('0/50 characters')).toBeInTheDocument()
    })

    it('should update character count when typing', () => {
      render(<CreateBoardForm />)

      const input = screen.getByPlaceholderText(
        /e\.g\., AI Experiments, Side Projects/i,
      )
      fireEvent.change(input, { target: { value: 'Test Board' } })

      expect(screen.getByText('10/50 characters')).toBeInTheDocument()
    })

    it('should have autoFocus on board name input', () => {
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
    it('should display Cancel button', () => {
      render(<CreateBoardForm />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeInTheDocument()
    })

    it('should display Create Board button', () => {
      render(<CreateBoardForm />)

      const createButton = screen.getByRole('button', {
        name: /create board/i,
      })
      expect(createButton).toBeInTheDocument()
    })

    it('should call router.back when Cancel is clicked', () => {
      render(<CreateBoardForm />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockBack).toHaveBeenCalled()
    })
  })

  describe('Theme Section Headers', () => {
    it('should display Light section header', () => {
      render(<CreateBoardForm />)

      expect(screen.getByText('Light')).toBeInTheDocument()
    })

    it('should display Dark section header', () => {
      render(<CreateBoardForm />)

      // "Dark" appears both as section header and theme button
      const darkElements = screen.getAllByText('Dark')
      // Section header is a <p> element
      const sectionHeader = darkElements.find(
        (el) =>
          el.tagName === 'P' && el.classList.contains('text-muted-foreground'),
      )
      expect(sectionHeader).toBeInTheDocument()
    })
  })
})
