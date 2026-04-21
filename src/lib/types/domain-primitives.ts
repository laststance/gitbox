/**
 * Domain-Level Primitive Aliases
 *
 * Named finite-value unions and meaningful primitive aliases that recur
 * throughout GitBox's domain. Using `Visibility` instead of
 * `'public' | 'private'` keeps call sites readable, localizes the set of
 * allowed values, and prevents drift if a third value is ever added.
 *
 * For ID branding, see {@link ./brands.ts}.
 */

/**
 * GitHub repository visibility — mirrors `Repository.visibility` from the
 * GitHub REST API. Stored on a `RepoCard` under `meta.visibility`.
 *
 * `'internal'` is the GitHub Enterprise Cloud visibility (repos visible to
 * all org members but not the public). Treated like `'private'` for access
 * checks but tagged distinctly in the UI.
 *
 * @example 'public'
 */
export type Visibility = 'public' | 'private' | 'internal'

/**
 * Card priority hint (UI-only, not persisted to the DB today).
 *
 * Used by `RepoCardDomain.priority` and consumed by `RepoCard.tsx` to render
 * badge accents. If this becomes persistent, migrate to a Postgres enum.
 *
 * @example 'high'
 */
export type Priority = 'low' | 'medium' | 'high'

/**
 * GitHub account discriminator returned by the `/user`, `/users/:login`, and
 * `/orgs/:login` endpoints. Used to distinguish personal accounts from
 * organizations in the repo picker.
 *
 * @example 'Organization'
 */
export type GitHubAccountType = 'User' | 'Organization'

/**
 * Repository owner / organization login — GitHub's stable lowercase handle
 * (never the display name). Used to build API URLs like `/orgs/:login/repos`.
 *
 * @example 'laststance'
 */
export type GitHubLogin = string

/**
 * ISO-8601 UTC timestamp string as returned by Supabase and GitHub.
 *
 * Not branded — doing so would force every Storybook fixture and unit test
 * to wrap literals via a factory, and the practical risk of mixing a
 * timestamp with unrelated text is low. Kept as a named alias so field
 * types communicate intent ("this string is a timestamp, format via
 * `new Date(...)`") without runtime friction.
 *
 * @example '2026-04-21T12:34:56.789Z'
 */
export type ISOTimestamp = string

/**
 * Public share slug for a board, or `null` when sharing is disabled.
 *
 * Slugs live under `board.share_slug` and are surfaced at `/public/:slug`.
 *
 * @example 'my-awesome-board-a1b2c3'
 */
export type ShareSlug = string | null

/**
 * Current organization filter for the "Add repository" picker.
 *
 * The literal `'all'` is the "no filter" sentinel; any other value is a
 * {@link GitHubLogin}. The `(string & {})` guard keeps the literal
 * auto-complete working while still accepting arbitrary logins.
 *
 * @example 'all'
 * @example 'laststance'
 */
export type OrganizationFilter = 'all' | (string & {})

/**
 * Name of a `lucide-react` icon component, looked up at runtime in the link
 * preview and preset picker UI. Kept as a plain alias — the lucide-react
 * package exports several hundred icons, so enumerating them as a union
 * would be noisy and would drift every lucide release.
 *
 * Validation happens at render time (`LinkIcon[iconName] ?? FallbackIcon`).
 *
 * @example 'Triangle'
 * @example 'Github'
 */
export type LucideIconName = string

/**
 * Stable kebab-case identifier for a link-type preset (built-in or
 * user-defined). Used as the React key and as the persisted value on
 * `projectinfo.links[].type`.
 *
 * @example 'vercel'
 * @example 'my-custom-service'
 */
export type LinkPresetValue = string

/**
 * Human-readable display name for a link-type preset. Shown in preset
 * pickers and, when no title is set, falls back as the link label.
 *
 * @example 'Vercel'
 * @example 'My Custom Service'
 */
export type LinkPresetLabel = string

/**
 * GitHub repository identifier in `owner/repo` format, lowercased for
 * case-insensitive matching. Used by `AddRepositoryCombobox` to exclude
 * repositories already archived in Maintenance.
 *
 * @example 'laststance/gitbox'
 */
export type RepoIdentifier = string

/**
 * Absolute URL to a user avatar image, typically from GitHub user metadata
 * (`avatar_url`). Optional on {@link UserProfile} because legacy rows may
 * pre-date the provider metadata capture.
 *
 * @example 'https://avatars.githubusercontent.com/u/12345?v=4'
 */
export type AvatarUrl = string
