/**
 * GitBox MCP error envelope
 *
 * The failure shape every tool of `/api/mcp` answers with. Agents self-correct
 * from it: `code` names the refusal and `hints` carries what would fix the
 * call (the boards that exist, the names that matched, the tool to call for
 * valid link types, the placements that do exist).
 *
 * Codes are MCP-local rather than reusing {@link ActionErrorCode}: the action
 * union has `CARD_NOT_FOUND` but none of the board-resolution or link codes
 * these tools need.
 */

/** Refusal codes the GitBox MCP endpoint can return. */
export type McpErrorCode =
  | 'BOARD_NOT_FOUND'
  | 'AMBIGUOUS_BOARD'
  | 'CARD_NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_LINK_TYPE'
  | 'INVALID_LINK_URL'
  | 'INVALID_REPO'
  | 'OPERATION_FAILED'
  | 'RATE_LIMITED'
  | 'MCP_DISABLED'
  | 'UNAUTHORIZED'
  | 'INTERNAL'

/** The `{ ok: false, error, code, hints }` envelope of a refused tool call. */
export interface McpErrorEnvelope {
  ok: false
  /** One sentence describing the refusal. */
  error: string
  /** Machine-readable refusal code. */
  code: McpErrorCode
  /** Data that helps the caller fix the call (candidate boards, valid link types, …). */
  hints?: unknown
}

/**
 * Build a refusal envelope.
 *
 * @param code - Machine-readable refusal code.
 * @param error - One sentence describing the refusal.
 * @param hints - Optional data that helps the caller fix the call.
 * @returns The `{ ok: false, error, code, hints }` envelope.
 * @example
 * mcpError('BOARD_NOT_FOUND', 'No board named "Work"', { availableBoards: ['Main'] })
 */
export function mcpError(
  code: McpErrorCode,
  error: string,
  hints?: unknown,
): McpErrorEnvelope {
  return hints === undefined
    ? { ok: false, error, code }
    : { ok: false, error, code, hints }
}
