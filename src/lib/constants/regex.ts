export const HEX_COLOR_CODE = /^#[0-9A-Fa-f]{6}$/

/**
 * One segment of a GitHub `owner/name` pair: letters, digits, `_`, `.`, `-`,
 * 1 to 100 characters. Deliberately the union of what GitHub allows for owner
 * logins and repository names, so anything outside it cannot be a real repository.
 */
export const GITHUB_NAME_SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/
