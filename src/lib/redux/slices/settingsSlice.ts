/**
 * Settings Slice
 *
 * User settings management (synchronized with LocalStorage)
 * - Theme
 * - Compact Mode
 * - Card Metadata visibility
 * - Organization Filter
 * - Sidebar collapsed state
 * - Destination of the last move from each board
 * - Note editor visibility (per repository) and height
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

import { NOTE_EDITOR_HEIGHT_DEFAULT_PX } from '@/lib/constants/note-editor'
import type { ThemeType } from '@/lib/constants/themes'
import type {
  OrganizationFilter,
  RepoIdentifier,
} from '@/lib/types/domain-primitives'

/** Shape of the `state.settings` Redux slice. */
interface SettingsState {
  /** Active theme (one of the 14 themes or `'system'`). */
  theme: ThemeType
  /** Compact-mode toggle — denser spacing/typography when `true`. */
  compactMode: boolean
  /** Display stars, language, and last-updated chips on repo cards. */
  showCardMetadata: boolean
  /**
   * Current filter in the "Add repository" picker.
   * Either `'all'` (no filter) or a GitHub org login.
   */
  organizationFilter: OrganizationFilter
  /** `true` when the sidebar is collapsed to icon-only view. */
  sidebarCollapsed: boolean
  /**
   * For each board a card was moved away from, the board that move went to
   * (board ids on both sides). {@link MoveToAnotherBoardDialog} opens on that
   * destination the next time, so setting several cards aside takes no
   * picking. This browser only.
   *
   * Optional: state persisted before the field existed has no such key, and
   * the storage middleware puts the persisted slice in place of the initial
   * one as a whole.
   */
  moveDestinationByBoard?: Record<string, string>
  /**
   * Height in px of the note editor in NoteModal, dragged to by the
   * bottom-edge handle. One value for every note: the choice is about the
   * editor, not the repository. This browser only.
   */
  noteEditorHeight: number
  /**
   * Per-repository "show the note editor" choice in NoteModal
   * (`owner/name` → visible). A repository missing from the map derives
   * its visibility from whether the note has content. This browser only.
   *
   * Optional: state persisted before the field existed has no such key, and
   * the storage middleware puts the persisted slice in place of the initial
   * one as a whole.
   */
  noteEditorOpenByRepo?: Record<string, boolean>
}

const initialState: SettingsState = {
  theme: 'system',
  compactMode: false,
  showCardMetadata: true,
  organizationFilter: 'all',
  sidebarCollapsed: false,
  moveDestinationByBoard: {},
  noteEditorHeight: NOTE_EDITOR_HEIGHT_DEFAULT_PX,
  noteEditorOpenByRepo: {},
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemeType>) => {
      state.theme = action.payload
    },
    setCompactMode: (state, action: PayloadAction<boolean>) => {
      state.compactMode = action.payload
    },
    setShowCardMetadata: (state, action: PayloadAction<boolean>) => {
      state.showCardMetadata = action.payload
    },
    setOrganizationFilter: (
      state,
      action: PayloadAction<OrganizationFilter>,
    ) => {
      state.organizationFilter = action.payload
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    /**
     * Remembers where the last move from a board went. Dispatched by
     * {@link MoveToAnotherBoardDialog} after a move succeeded.
     *
     * @param action.payload.sourceBoardId - Board the card was moved from.
     * @param action.payload.destinationBoardId - Board the card was moved to.
     */
    setMoveDestination: (
      state,
      action: PayloadAction<{
        sourceBoardId: string
        destinationBoardId: string
      }>,
    ) => {
      // Spread, not an assignment into the map: the map is missing in state
      // persisted before the field existed
      state.moveDestinationByBoard = {
        ...state.moveDestinationByBoard,
        [action.payload.sourceBoardId]: action.payload.destinationBoardId,
      }
    },
    /**
     * Forgets where the last move from each board went.
     *
     * Called by {@link forgetAccountOnThisBrowser} on sign-out and account
     * deletion. The theme and the other display settings stay: they are this
     * browser's choices, not the account's notes.
     */
    clearMoveDestinations: (state) => {
      state.moveDestinationByBoard = {}
    },
    /**
     * Sets the note editor's height. Dispatched by {@link NoteSection}'s
     * bottom-edge resize handle while dragging or on its arrow keys.
     *
     * @param action.payload - The new height in px. Bounds are the caller's
     *   job ({@link NOTE_EDITOR_HEIGHT_MIN_PX} … `70vh`).
     */
    setNoteEditorHeight: (state, action: PayloadAction<number>) => {
      state.noteEditorHeight = action.payload
    },
    /**
     * Remembers the note editor's visibility for one repository. Dispatched
     * by {@link NoteSection} when its switch is toggled. A repository absent
     * from the map falls back to showing the editor when the note has
     * content.
     *
     * @param action.payload.repoKey - Lowercase `owner/name` the note belongs to.
     * @param action.payload.open - Whether the editor is shown for it.
     */
    setNoteEditorOpen: (
      state,
      action: PayloadAction<{ repoKey: RepoIdentifier; open: boolean }>,
    ) => {
      // Spread, not an assignment into the map: the map is missing in state
      // persisted before the field existed
      state.noteEditorOpenByRepo = {
        ...state.noteEditorOpenByRepo,
        [action.payload.repoKey]: action.payload.open,
      }
    },
    /**
     * Forgets every remembered note-editor visibility.
     *
     * Called by {@link forgetAccountOnThisBrowser} on sign-out and account
     * deletion: the map's keys are repository names of the account that
     * left, which the next account must not read. The editor's height
     * stays: a display choice of this browser, like the theme.
     */
    clearNoteEditorOpenByRepo: (state) => {
      state.noteEditorOpenByRepo = {}
    },
  },
})

export const {
  setTheme,
  setCompactMode,
  setShowCardMetadata,
  setOrganizationFilter,
  setSidebarCollapsed,
  toggleSidebarCollapsed,
  setMoveDestination,
  clearMoveDestinations,
  setNoteEditorHeight,
  setNoteEditorOpen,
  clearNoteEditorOpenByRepo,
} = settingsSlice.actions

export default settingsSlice.reducer

// Selectors
/**
 * Selector for theme with safe default during hydration
 * @param state - Redux state with settings slice
 * @returns Theme value, defaults to 'system' if state is hydrating
 */
export const selectTheme = (state: { settings?: SettingsState }) =>
  state.settings?.theme ?? 'system'
export const selectCompactMode = (state: { settings: SettingsState }) =>
  state.settings.compactMode
export const selectShowCardMetadata = (state: { settings: SettingsState }) =>
  state.settings.showCardMetadata
/**
 * Selector for organization filter with safe default
 * @param state - Redux state with settings slice
 * @returns Organization filter value, defaults to 'all' if state is hydrating
 */
export const selectOrganizationFilter = (state: { settings?: SettingsState }) =>
  state.settings?.organizationFilter ?? 'all'

/**
 * Selector for sidebar collapsed state with safe default
 * @param state - Redux state with settings slice
 * @returns Sidebar collapsed value, defaults to false (expanded) if state is hydrating
 */
export const selectSidebarCollapsed = (state: { settings?: SettingsState }) =>
  state.settings?.sidebarCollapsed ?? false

/**
 * Reads the board the last move from a board went to. Called by
 * {@link MoveToAnotherBoardDialog} to choose the board it opens on.
 *
 * @param state - Redux state with settings slice
 * @param sourceBoardId - Board the card is about to be moved from.
 * @returns
 * - the destination board id of the last move from that board
 * - `undefined` when no card was moved from it in this browser yet, and while
 *   the state is hydrating
 * @example
 * selectMoveDestination(state, 'board-work') // => 'board-archive'
 */
export const selectMoveDestination = (
  state: { settings?: SettingsState },
  sourceBoardId: string,
): string | undefined => state.settings?.moveDestinationByBoard?.[sourceBoardId]

/**
 * Selector for the note editor's height with safe default during hydration.
 *
 * @param state - Redux state with settings slice
 * @returns The height in px the user last dragged to, or the default
 */
export const selectNoteEditorHeight = (state: { settings?: SettingsState }) =>
  state.settings?.noteEditorHeight ?? NOTE_EDITOR_HEIGHT_DEFAULT_PX

/**
 * Reads the remembered note-editor visibility of one repository. Called by
 * {@link NoteSection} when the note modal opens.
 *
 * @param state - Redux state with settings slice
 * @param repoKey - Lowercase `owner/name` the note belongs to.
 * @returns `true`/`false` when the user toggled it for this repository,
 *   `undefined` when never toggled (and while hydrating) — the caller then
 *   derives visibility from whether the note has content.
 * @example
 * selectNoteEditorOpen(state, 'laststance/gitbox') // => true | false | undefined
 */
export const selectNoteEditorOpen = (
  state: { settings?: SettingsState },
  repoKey: RepoIdentifier,
): boolean | undefined => state.settings?.noteEditorOpenByRepo?.[repoKey]
