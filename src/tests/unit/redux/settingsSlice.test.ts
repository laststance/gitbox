/**
 * Unit Tests: settingsSlice Redux Actions
 *
 * Tests for user settings state management including:
 * - setTheme action
 * - setCompactMode action
 * - setShowCardMetadata action
 * - setOrganizationFilter action
 * - setSidebarCollapsed action
 * - toggleSidebarCollapsed action
 * - setMoveDestination action
 * - All selectors with hydration safety
 */

import { describe, test, expect } from 'vitest'

import { NOTE_EDITOR_HEIGHT_DEFAULT_PX } from '@/lib/constants/note-editor'
import type { ThemeType } from '@/lib/constants/themes'
import settingsSlice, {
  setTheme,
  setCompactMode,
  setShowCardMetadata,
  setOrganizationFilter,
  setSidebarCollapsed,
  toggleSidebarCollapsed,
  setMoveDestination,
  setNoteEditorHeight,
  setNoteEditorOpen,
  clearNoteEditorOpenByRepo,
  selectTheme,
  selectCompactMode,
  selectShowCardMetadata,
  selectOrganizationFilter,
  selectSidebarCollapsed,
  selectMoveDestination,
  selectNoteEditorHeight,
  selectNoteEditorOpen,
} from '@/lib/redux/slices/settingsSlice'

describe('settingsSlice', () => {
  // Type for settings slice state (matches the slice's internal state)
  interface SettingsState {
    theme: ThemeType
    compactMode: boolean
    showCardMetadata: boolean
    organizationFilter: string
    sidebarCollapsed: boolean
    noteEditorHeight: number
  }

  const initialState: SettingsState = {
    theme: 'system',
    compactMode: false,
    showCardMetadata: true,
    organizationFilter: 'all',
    sidebarCollapsed: false,
    noteEditorHeight: NOTE_EDITOR_HEIGHT_DEFAULT_PX,
  }

  describe('setTheme action', () => {
    test('should set theme to dark', () => {
      const action = setTheme('dark')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.theme).toBe('dark')
    })

    test('should set theme to light', () => {
      const action = setTheme('default')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.theme).toBe('default')
    })

    test('should set theme to a named theme', () => {
      const action = setTheme('midnight')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.theme).toBe('midnight')
    })

    test('should set theme to sunrise', () => {
      const action = setTheme('sunrise')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.theme).toBe('sunrise')
    })

    test('should not affect other settings when changing theme', () => {
      const modifiedState = {
        ...initialState,
        compactMode: true,
        sidebarCollapsed: true,
      }

      const action = setTheme('ocean')
      const nextState = settingsSlice(modifiedState, action)

      expect(nextState.theme).toBe('ocean')
      expect(nextState.compactMode).toBe(true)
      expect(nextState.sidebarCollapsed).toBe(true)
    })
  })

  describe('setCompactMode action', () => {
    test('should enable compact mode', () => {
      const action = setCompactMode(true)

      const nextState = settingsSlice(initialState, action)

      expect(nextState.compactMode).toBe(true)
    })

    test('should disable compact mode', () => {
      const enabledState = { ...initialState, compactMode: true }
      const action = setCompactMode(false)

      const nextState = settingsSlice(enabledState, action)

      expect(nextState.compactMode).toBe(false)
    })
  })

  describe('setShowCardMetadata action', () => {
    test('should hide card metadata', () => {
      const action = setShowCardMetadata(false)

      const nextState = settingsSlice(initialState, action)

      expect(nextState.showCardMetadata).toBe(false)
    })

    test('should show card metadata', () => {
      const hiddenState = { ...initialState, showCardMetadata: false }
      const action = setShowCardMetadata(true)

      const nextState = settingsSlice(hiddenState, action)

      expect(nextState.showCardMetadata).toBe(true)
    })
  })

  describe('setOrganizationFilter action', () => {
    test('should set organization filter to specific org', () => {
      const action = setOrganizationFilter('laststance')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.organizationFilter).toBe('laststance')
    })

    test('should reset organization filter to all', () => {
      const filteredState = {
        ...initialState,
        organizationFilter: 'laststance',
      }
      const action = setOrganizationFilter('all')

      const nextState = settingsSlice(filteredState, action)

      expect(nextState.organizationFilter).toBe('all')
    })

    test('should handle personal username', () => {
      const action = setOrganizationFilter('ryotamurakami')

      const nextState = settingsSlice(initialState, action)

      expect(nextState.organizationFilter).toBe('ryotamurakami')
    })
  })

  describe('setSidebarCollapsed action', () => {
    test('should collapse sidebar', () => {
      const action = setSidebarCollapsed(true)

      const nextState = settingsSlice(initialState, action)

      expect(nextState.sidebarCollapsed).toBe(true)
    })

    test('should expand sidebar', () => {
      const collapsedState = { ...initialState, sidebarCollapsed: true }
      const action = setSidebarCollapsed(false)

      const nextState = settingsSlice(collapsedState, action)

      expect(nextState.sidebarCollapsed).toBe(false)
    })
  })

  describe('toggleSidebarCollapsed action', () => {
    test('should toggle sidebar from expanded to collapsed', () => {
      const action = toggleSidebarCollapsed()

      const nextState = settingsSlice(initialState, action)

      expect(nextState.sidebarCollapsed).toBe(true)
    })

    test('should toggle sidebar from collapsed to expanded', () => {
      const collapsedState = { ...initialState, sidebarCollapsed: true }
      const action = toggleSidebarCollapsed()

      const nextState = settingsSlice(collapsedState, action)

      expect(nextState.sidebarCollapsed).toBe(false)
    })

    test('should toggle multiple times correctly', () => {
      let state: SettingsState = initialState

      state = settingsSlice(state, toggleSidebarCollapsed())
      expect(state.sidebarCollapsed).toBe(true)

      state = settingsSlice(state, toggleSidebarCollapsed())
      expect(state.sidebarCollapsed).toBe(false)

      state = settingsSlice(state, toggleSidebarCollapsed())
      expect(state.sidebarCollapsed).toBe(true)
    })
  })

  describe('Selectors', () => {
    describe('selectTheme', () => {
      test('should return theme value', () => {
        const rootState = {
          settings: { ...initialState, theme: 'dark' as const },
        }

        const result = selectTheme(rootState)

        expect(result).toBe('dark')
      })

      test('should return system as default during hydration', () => {
        // Simulating state during hydration where settings might be undefined
        const rootState = { settings: undefined } as any

        const result = selectTheme(rootState)

        expect(result).toBe('system')
      })

      test('should return system when settings exists but theme is undefined', () => {
        // Edge case: settings object exists but theme property is undefined
        const rootState = { settings: { theme: undefined } } as any

        const result = selectTheme(rootState)

        expect(result).toBe('system')
      })
    })

    describe('selectCompactMode', () => {
      test('should return compact mode setting', () => {
        const rootState = { settings: { ...initialState, compactMode: true } }

        const result = selectCompactMode(rootState)

        expect(result).toBe(true)
      })
    })

    describe('selectShowCardMetadata', () => {
      test('should return show card metadata setting', () => {
        const rootState = {
          settings: { ...initialState, showCardMetadata: false },
        }

        const result = selectShowCardMetadata(rootState)

        expect(result).toBe(false)
      })
    })

    describe('selectOrganizationFilter', () => {
      test('should return organization filter', () => {
        const rootState = {
          settings: { ...initialState, organizationFilter: 'laststance' },
        }

        const result = selectOrganizationFilter(rootState)

        expect(result).toBe('laststance')
      })

      test('should return all as default during hydration', () => {
        const rootState = { settings: undefined } as any

        const result = selectOrganizationFilter(rootState)

        expect(result).toBe('all')
      })

      test('should return all when settings exists but organizationFilter is undefined', () => {
        const rootState = { settings: { organizationFilter: undefined } } as any

        const result = selectOrganizationFilter(rootState)

        expect(result).toBe('all')
      })
    })

    describe('selectSidebarCollapsed', () => {
      test('should return sidebar collapsed state', () => {
        const rootState = {
          settings: { ...initialState, sidebarCollapsed: true },
        }

        const result = selectSidebarCollapsed(rootState)

        expect(result).toBe(true)
      })

      test('should return false as default during hydration', () => {
        const rootState = { settings: undefined } as any

        const result = selectSidebarCollapsed(rootState)

        expect(result).toBe(false)
      })

      test('should return false when settings exists but sidebarCollapsed is undefined', () => {
        const rootState = { settings: { sidebarCollapsed: undefined } } as any

        const result = selectSidebarCollapsed(rootState)

        expect(result).toBe(false)
      })
    })

    describe('selectMoveDestination', () => {
      test('returns the board the last move from a board went to', () => {
        // Arrange
        const rootState = {
          settings: {
            ...initialState,
            moveDestinationByBoard: { 'board-work': 'board-archive' },
          },
        }

        // Act
        const destinationBoardId = selectMoveDestination(
          rootState,
          'board-work',
        )

        // Assert
        expect(destinationBoardId).toBe('board-archive')
      })

      test('returns nothing for a board no card was moved from', () => {
        // Arrange
        const rootState = {
          settings: {
            ...initialState,
            moveDestinationByBoard: { 'board-work': 'board-archive' },
          },
        }

        // Act
        const destinationBoardId = selectMoveDestination(
          rootState,
          'board-side',
        )

        // Assert
        expect(destinationBoardId).toBeUndefined()
      })

      test('returns nothing for settings saved before moves were remembered', () => {
        // Arrange: persisted state of an older version has no such key
        const rootState = { settings: initialState }

        // Act
        const destinationBoardId = selectMoveDestination(
          rootState,
          'board-work',
        )

        // Assert
        expect(destinationBoardId).toBeUndefined()
      })

      test('returns nothing while the settings are still hydrating', () => {
        // Arrange
        const rootState = { settings: undefined }

        // Act
        const destinationBoardId = selectMoveDestination(
          rootState,
          'board-work',
        )

        // Assert
        expect(destinationBoardId).toBeUndefined()
      })
    })
    describe('selectNoteEditorHeight', () => {
      test('returns the height the note editor was resized to', () => {
        // Arrange
        const rootState = {
          settings: { ...initialState, noteEditorHeight: 620 },
        }

        // Act
        const result = selectNoteEditorHeight(rootState)

        // Assert
        expect(result).toBe(620)
      })

      test('returns the default height during hydration', () => {
        // Arrange
        const rootState = { settings: undefined }

        // Act
        const result = selectNoteEditorHeight(rootState)

        // Assert
        expect(result).toBe(NOTE_EDITOR_HEIGHT_DEFAULT_PX)
      })
    })

    describe('selectNoteEditorOpen', () => {
      test('returns the visibility remembered for that repository', () => {
        // Arrange
        const rootState = {
          settings: {
            ...initialState,
            noteEditorOpenByRepo: { 'laststance/gitbox': false },
          },
        }

        // Act
        const result = selectNoteEditorOpen(rootState, 'laststance/gitbox')

        // Assert
        expect(result).toBe(false)
      })

      test('returns nothing for a repository whose switch was never toggled', () => {
        // Arrange
        const rootState = {
          settings: {
            ...initialState,
            noteEditorOpenByRepo: { 'laststance/gitbox': false },
          },
        }

        // Act
        const result = selectNoteEditorOpen(rootState, 'vercel/next.js')

        // Assert
        expect(result).toBeUndefined()
      })

      test('returns nothing while the settings are still hydrating', () => {
        // Arrange
        const rootState = { settings: undefined }

        // Act
        const result = selectNoteEditorOpen(rootState, 'laststance/gitbox')

        // Assert
        expect(result).toBeUndefined()
      })
    })
  })

  describe('setMoveDestination action', () => {
    test('remembers where a move went, separately for each board a card came from', () => {
      // Arrange
      const stateWithOneMove = {
        ...initialState,
        moveDestinationByBoard: { 'board-work': 'board-archive' },
      }

      // Act
      const nextState = settingsSlice(
        stateWithOneMove,
        setMoveDestination({
          sourceBoardId: 'board-side',
          destinationBoardId: 'board-work',
        }),
      )

      // Assert
      expect(nextState.moveDestinationByBoard).toEqual({
        'board-work': 'board-archive',
        'board-side': 'board-work',
      })
    })

    test('replaces the remembered board when a later move from the same board goes elsewhere', () => {
      // Arrange
      const stateWithOneMove = {
        ...initialState,
        moveDestinationByBoard: { 'board-work': 'board-archive' },
      }

      // Act
      const nextState = settingsSlice(
        stateWithOneMove,
        setMoveDestination({
          sourceBoardId: 'board-work',
          destinationBoardId: 'board-side',
        }),
      )

      // Assert
      expect(nextState.moveDestinationByBoard).toEqual({
        'board-work': 'board-side',
      })
    })

    test('remembers a move in settings saved before moves were remembered', () => {
      // Arrange: persisted state of an older version has no such key
      const stateSavedByAnOlderVersion = initialState

      // Act
      const nextState = settingsSlice(
        stateSavedByAnOlderVersion,
        setMoveDestination({
          sourceBoardId: 'board-work',
          destinationBoardId: 'board-archive',
        }),
      )

      // Assert
      expect(nextState.moveDestinationByBoard).toEqual({
        'board-work': 'board-archive',
      })
    })
  })

  describe('setNoteEditorHeight action', () => {
    test('stores the height the note editor was resized to', () => {
      // Arrange
      const action = setNoteEditorHeight(620)

      // Act
      const nextState = settingsSlice(initialState, action)

      // Assert
      expect(nextState.noteEditorHeight).toBe(620)
    })
  })

  describe('setNoteEditorOpen action', () => {
    test('remembers the editor visibility for one repository', () => {
      // Arrange
      const action = setNoteEditorOpen({
        repoKey: 'laststance/gitbox',
        open: false,
      })

      // Act
      const nextState = settingsSlice(initialState, action)

      // Assert
      expect(nextState.noteEditorOpenByRepo).toEqual({
        'laststance/gitbox': false,
      })
    })

    test('remembers each repository separately', () => {
      // Arrange
      const stateWithOneChoice = {
        ...initialState,
        noteEditorOpenByRepo: { 'laststance/gitbox': false },
      }

      // Act
      const nextState = settingsSlice(
        stateWithOneChoice,
        setNoteEditorOpen({ repoKey: 'vercel/next.js', open: true }),
      )

      // Assert
      expect(nextState.noteEditorOpenByRepo).toEqual({
        'laststance/gitbox': false,
        'vercel/next.js': true,
      })
    })

    test('replaces the remembered visibility when the same repository is toggled again', () => {
      // Arrange
      const stateWithOneChoice = {
        ...initialState,
        noteEditorOpenByRepo: { 'laststance/gitbox': false },
      }

      // Act
      const nextState = settingsSlice(
        stateWithOneChoice,
        setNoteEditorOpen({ repoKey: 'laststance/gitbox', open: true }),
      )

      // Assert
      expect(nextState.noteEditorOpenByRepo).toEqual({
        'laststance/gitbox': true,
      })
    })

    test('remembers a visibility in settings saved before editor visibility was remembered', () => {
      // Arrange: persisted state of an older version has no such key
      const stateSavedByAnOlderVersion = initialState

      // Act
      const nextState = settingsSlice(
        stateSavedByAnOlderVersion,
        setNoteEditorOpen({ repoKey: 'laststance/gitbox', open: true }),
      )

      // Assert
      expect(nextState.noteEditorOpenByRepo).toEqual({
        'laststance/gitbox': true,
      })
    })
  })

  describe('clearNoteEditorOpenByRepo action', () => {
    test('forgets every remembered editor visibility', () => {
      // Arrange
      const stateWithChoices = {
        ...initialState,
        noteEditorOpenByRepo: {
          'laststance/gitbox': false,
          'vercel/next.js': true,
        },
      }

      // Act
      const nextState = settingsSlice(
        stateWithChoices,
        clearNoteEditorOpenByRepo(),
      )

      // Assert
      expect(nextState.noteEditorOpenByRepo).toEqual({})
    })
  })
})
