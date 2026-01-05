/**
 * Validation Schemas - Barrel Export
 *
 * Central export point for all Zod validation schemas.
 * Import from '@/lib/validations' instead of individual files.
 *
 * @example
 * import { boardNameSchema, uuidSchema, toFieldErrors } from '@/lib/validations'
 */

// Common schemas
export {
  uuidSchema,
  urlSchema,
  optionalUrlSchema,
  type UuidInput,
  type UrlInput,
  type OptionalUrlInput,
} from './common'

// Helper functions
export {
  toFieldErrors,
  getRootErrors,
  getAllErrors,
  getFirstError,
} from './helpers'

// Board schemas
export {
  BOARD_NAME_MAX_LENGTH,
  boardNameSchema,
  boardIdSchema,
  themeSchema,
  boardSettingsSchema,
  renameBoardFormSchema,
  deleteBoardFormSchema,
  updateThemeFormSchema,
  updateSettingsFormSchema,
  type BoardNameInput,
  type BoardSettingsInput,
} from './board'

// Project info schemas
export {
  NOTE_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  VALID_COMMENT_COLORS,
  DEFAULT_COMMENT_COLOR,
  noteSchema,
  commentSchema,
  commentColorSchema,
  projectLinkUrlSchema,
  projectLinkSchema,
  projectLinksArraySchema,
  linksInputSchema,
  validateNoteWithSchema,
  validateCommentWithSchema,
  validateCommentColorWithSchema,
  validateUrlWithSchema,
  type CommentColorType,
  type NoteInput,
  type CommentInput,
  type ProjectLinkInput,
} from './project-info'

// User presets schemas
export {
  MAX_CUSTOM_PRESETS,
  MAX_LABEL_LENGTH,
  KEBAB_CASE_REGEX,
  presetValueSchema,
  presetLabelSchema,
  presetIconSchema,
  createPresetSchema,
  updatePresetSchema,
  validatePresetValueWithSchema,
  validatePresetLabelWithSchema,
  type PresetValueInput,
  type PresetLabelInput,
  type PresetIconInput,
  type CreatePresetInput,
  type UpdatePresetInput,
} from './user-presets'

// URL validation utility (for EditableUrlItem)
export { MAX_URL_LENGTH, isValidUrl } from './url'
