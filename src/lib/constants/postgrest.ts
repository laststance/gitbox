/**
 * PostgREST caps the number of rows returned per request and per embedded
 * relation (`db-max-rows`, set to 1000 in `supabase/config.toml`). A result
 * that reaches this size may be silently truncated, so callers warn at the cap.
 */
export const POSTGREST_MAX_ROWS = 1000
