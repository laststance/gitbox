/**
 * Unit Tests: PresetSelector
 *
 * The preset cards of `/boards/new`. `createBoard` accepts one preset more
 * than the page offers: `single-column`, which the Move to Another Board
 * dialog uses for a board made on the spot. These tests pin that the page
 * keeps offering its six presets and that the extra one gets no card.
 *
 * @see src/app/boards/new/PresetSelector.tsx
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { PresetSelector } from '@/app/boards/new/PresetSelector'

describe('PresetSelector', () => {
  test('offers the six presets a board can start from, and no card for the one-column preset of the move dialog', () => {
    // Arrange & Act
    render(<PresetSelector value="web-app" onChange={vi.fn()} />)

    // Assert
    const presetCardTitles = screen
      .getAllByRole('radio')
      .map((presetCard) => presetCard.firstElementChild?.textContent)
    expect(presetCardTitles).toEqual([
      'Software Release',
      'Web App',
      'Electron Desktop',
      'CLI Tool',
      'Mobile',
      'macOS',
    ])
    expect(screen.queryByText('Single Column')).toBeNull()
  })

  test('marks the current preset as the chosen one', () => {
    // Arrange & Act
    render(<PresetSelector value="web-app" onChange={vi.fn()} />)

    // Assert
    expect(screen.getByRole('radio', { name: /^Web App/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^CLI Tool/ })).not.toBeChecked()
  })

  test('hands the preset of a clicked card to the form', async () => {
    // Arrange
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PresetSelector value="web-app" onChange={onChange} />)

    // Act
    await user.click(screen.getByRole('radio', { name: /^CLI Tool/ }))

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('cli-tool')
  })
})
