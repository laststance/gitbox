/**
 * Unit Tests: note editor height bounds
 *
 * The resize handle and the rendered height of the note editor share these
 * bounds: a drag and a window change both clamp to [MIN, 70vh].
 */

import { describe, expect, test } from 'vitest'

import {
  clampNoteEditorHeight,
  maxNoteEditorHeightPx,
  NOTE_EDITOR_HEIGHT_MAX_VH_RATIO,
  NOTE_EDITOR_HEIGHT_MIN_PX,
} from '@/lib/constants/note-editor'

describe('maxNoteEditorHeightPx', () => {
  test('caps the editor at 70% of the window height', () => {
    // Arrange
    const viewportPx = 1000

    // Act
    const result = maxNoteEditorHeightPx(viewportPx)

    // Assert
    expect(result).toBe(700)
  })

  test('never drops below the minimum on a tiny window', () => {
    // Arrange
    const viewportPx = 100

    // Act
    const result = maxNoteEditorHeightPx(viewportPx)

    // Assert
    expect(result).toBe(NOTE_EDITOR_HEIGHT_MIN_PX)
  })
})

describe('clampNoteEditorHeight', () => {
  test('keeps a height inside the range as it is', () => {
    // Arrange
    const heightPx = 400
    const viewportPx = 1000

    // Act
    const result = clampNoteEditorHeight(heightPx, viewportPx)

    // Assert
    expect(result).toBe(400)
  })

  test('pulls a height below the minimum up to it', () => {
    // Arrange
    const heightPx = 50
    const viewportPx = 1000

    // Act
    const result = clampNoteEditorHeight(heightPx, viewportPx)

    // Assert
    expect(result).toBe(NOTE_EDITOR_HEIGHT_MIN_PX)
  })

  test('pulls a height above 70vh down to it', () => {
    // Arrange: a height dragged on a taller window
    const heightPx = 2000
    const viewportPx = 1000

    // Act
    const result = clampNoteEditorHeight(heightPx, viewportPx)

    // Assert
    expect(result).toBe(Math.round(1000 * NOTE_EDITOR_HEIGHT_MAX_VH_RATIO))
  })
})
