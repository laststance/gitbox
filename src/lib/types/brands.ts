/**
 * Branded ID Types
 *
 * Nominal types for domain identifiers. Every root entity in GitBox is
 * identified by a UUID string, which means the structural type system cannot
 * distinguish a `BoardId` from a `RepoCardId` on its own — both are just
 * `string`. Branded types attach a phantom `__brand` tag so the compiler
 * catches accidental swaps.
 *
 * @example
 * import { toBoardId, type BoardId, type RepoCardId } from '@/lib/types/brands'
 *
 * const boardId: BoardId = toBoardId(row.id)
 * deleteBoard(boardId)      // ok
 * deleteRepoCard(boardId)   // compile error: RepoCardId expected
 *
 * @remarks
 * - Pure annotation — zero runtime cost.
 * - A branded ID is still assignable to `string`, so callers can pass it to
 *   legacy APIs that expect a bare string without casts.
 * - Produce branded values only at trust boundaries (DB → domain in
 *   `src/lib/actions/mappers.ts`, Supabase user → `UserId` in auth-guard).
 *   Do not scatter `as BoardId` casts through application code.
 */

/**
 * Attach a compile-time nominal tag to a base type.
 *
 * @template T The underlying primitive (typically `string` for UUIDs).
 * @template B A unique tag — use the exported type name so brands stay distinct.
 * @example
 * type SessionToken = Brand<string, 'SessionToken'>
 */
export type Brand<T, B extends string> = T & { readonly __brand: B }

/**
 * UUID v4 identifier for a Kanban board (`board.id`).
 * @example '8f3a2b9c-1d4e-4f5a-9b6c-7d8e9f0a1b2c'
 */
export type BoardId = Brand<string, 'BoardId'>

/**
 * UUID v4 identifier for a status list column within a board
 * (`statuslist.id`).
 * @example '2e4b5c7d-8f9a-4b1c-9d2e-3f4a5b6c7d8e'
 */
export type StatusListId = Brand<string, 'StatusListId'>

/**
 * UUID v4 identifier for a repository card within a status list
 * (`repocard.id`).
 * @example 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
 */
export type RepoCardId = Brand<string, 'RepoCardId'>

/**
 * UUID v4 identifier for a project info record (notes / links / comments)
 * (`projectinfo.id`).
 * @example 'f9e8d7c6-5b4a-4321-9876-543210fedcba'
 */
export type ProjectInfoId = Brand<string, 'ProjectInfoId'>

/**
 * UUID v4 identifier for an archived/maintenance repository
 * (`maintenance.id`).
 * @example '11223344-5566-4778-8899-aabbccddeeff'
 */
export type MaintenanceId = Brand<string, 'MaintenanceId'>

/**
 * UUID v4 identifier for a Supabase auth user (`auth.users.id` /
 * `board.user_id` / `maintenance.user_id` / `user_link_presets.user_id`).
 * @example 'deadbeef-cafe-4123-8456-000000000000'
 */
export type UserId = Brand<string, 'UserId'>

/**
 * UUID v4 identifier for a user-defined link-type preset
 * (`user_link_presets.id`).
 * @example '0a1b2c3d-4e5f-4617-8b89-0c1d2e3f4a5b'
 */
export type UserLinkPresetId = Brand<string, 'UserLinkPresetId'>

/**
 * Union of identifier brands that can appear in shared card UI
 * (e.g. {@link ./../../components/Board/OverflowMenu.tsx OverflowMenu},
 * {@link ./../../components/Modals/NoteModal.tsx NoteModal}, draft slice).
 *
 * Components that render or forward a card ID through callbacks shouldn't
 * care whether the card is on a board ({@link RepoCardId}) or archived
 * ({@link MaintenanceId}) — they just need a stable string key. Callers that
 * *act* on the ID continue to use the narrower brand (`RepoCardId` inside
 * board code, `MaintenanceId` inside maintenance code).
 *
 * @example
 * const cardIds: CardIdentifier[] = [toRepoCardId(row.id), toMaintenanceId(row.id)]
 */
export type CardIdentifier = RepoCardId | MaintenanceId

/**
 * URL-safe public share slug for a board (`board.share_slug` when not null).
 *
 * Distinct from {@link BoardId} because it travels through the URL path
 * `/public/:slug` and is user-visible — a consumer who confuses it with the
 * board UUID would query the wrong column. Branding rules that class of bug
 * out at the type level.
 *
 * See also {@link ./domain-primitives.ts#ShareSlug}, which is the nullable
 * DB-row form (`string | null`) before slug presence has been asserted.
 *
 * @example 'my-awesome-board-a1b2c3'
 */
export type PublicBoardSlug = Brand<string, 'PublicBoardSlug'>

// ========================================
// Factory functions (trust boundary only)
// ========================================

/**
 * Mark a raw string as a {@link BoardId}. Use where DB rows or user input
 * enter the domain; never in general application code.
 * @example const id = toBoardId(row.id)
 */
export const toBoardId = (id: string): BoardId => id as BoardId

/**
 * Mark a raw string as a {@link StatusListId}. Use at the DB→domain boundary.
 * @example const id = toStatusListId(row.id)
 */
export const toStatusListId = (id: string): StatusListId => id as StatusListId

/**
 * Mark a raw string as a {@link RepoCardId}. Use at the DB→domain boundary.
 * @example const id = toRepoCardId(row.id)
 */
export const toRepoCardId = (id: string): RepoCardId => id as RepoCardId

/**
 * Mark a raw string as a {@link ProjectInfoId}. Use at the DB→domain boundary.
 * @example const id = toProjectInfoId(row.id)
 */
export const toProjectInfoId = (id: string): ProjectInfoId =>
  id as ProjectInfoId

/**
 * Mark a raw string as a {@link MaintenanceId}. Use at the DB→domain boundary.
 * @example const id = toMaintenanceId(row.id)
 */
export const toMaintenanceId = (id: string): MaintenanceId =>
  id as MaintenanceId

/**
 * Mark a raw string as a {@link UserId}. Typically called once after fetching
 * the Supabase session: `toUserId(user.id)`.
 * @example const uid = toUserId(session.user.id)
 */
export const toUserId = (id: string): UserId => id as UserId

/**
 * Mark a raw string as a {@link UserLinkPresetId}. Use at the DB→domain
 * boundary when mapping `user_link_presets` rows.
 * @example const id = toUserLinkPresetId(row.id)
 */
export const toUserLinkPresetId = (id: string): UserLinkPresetId =>
  id as UserLinkPresetId

/**
 * Mark a raw string as a {@link PublicBoardSlug}. Call this once where the
 * slug enters the domain — typically the `/public/:slug` route handler or
 * the `getBoardBySlug` Server Action.
 * @example const slug = toPublicBoardSlug(params.slug)
 */
export const toPublicBoardSlug = (slug: string): PublicBoardSlug =>
  slug as PublicBoardSlug
