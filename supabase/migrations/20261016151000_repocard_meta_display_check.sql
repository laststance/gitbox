-- ============================================================================
-- Display metadata stored on a card must stay renderable
-- ============================================================================
--
-- addRepositoriesToBoard copies description, language, topics, stars,
-- visibility and updatedAt into repocard.meta. The board and the public page
-- print those fields as text. Row level security lets the owner insert a card
-- directly, so the request schema alone does not cover that path.
--
-- repocard_meta_is_display_metadata refuses a meta value that is not an
-- object, that is larger than 8192 bytes, or whose display fields are the
-- wrong type or longer than the request schema allows (description 350,
-- language 100, 20 topics of 50, stars and githubId as safe integers,
-- visibility public/private/internal, updatedAt a string of at most 40
-- characters). Null meta and {} pass. Other keys are left alone, inside the
-- size cap, so a card saved before this check still updates.
--
-- Existing rows are counted first. A row that would fail stops the migration
-- before the constraint is added, and the message carries the count only.
--
-- One statement (a DO block) and re-runnable.
--
-- Rollback (new migration):
--   ALTER TABLE repocard DROP CONSTRAINT repocard_meta_display;
--   DROP FUNCTION repocard_meta_is_display_metadata(jsonb);
-- ============================================================================

DO $migration$
DECLARE
  v_bad_rows integer;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'repocard_meta_display'
      AND conrelid = 'public.repocard'::regclass
  ) THEN
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.repocard_meta_is_display_metadata(p_meta jsonb)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path = pg_catalog
  AS $function$
    SELECT CASE
      WHEN p_meta IS NULL THEN true
      WHEN jsonb_typeof(p_meta) <> 'object' THEN false
      WHEN octet_length(p_meta::text) > 8192 THEN false
      WHEN p_meta ? 'description'
        AND jsonb_typeof(p_meta -> 'description') NOT IN ('string', 'null')
        THEN false
      WHEN p_meta ? 'description'
        AND jsonb_typeof(p_meta -> 'description') = 'string'
        AND length(p_meta ->> 'description') > 350
        THEN false
      WHEN p_meta ? 'language'
        AND jsonb_typeof(p_meta -> 'language') NOT IN ('string', 'null')
        THEN false
      WHEN p_meta ? 'language'
        AND jsonb_typeof(p_meta -> 'language') = 'string'
        AND length(p_meta ->> 'language') > 100
        THEN false
      WHEN p_meta ? 'topics' AND CASE
        WHEN jsonb_typeof(p_meta -> 'topics') <> 'array' THEN true
        WHEN jsonb_array_length(p_meta -> 'topics') > 20 THEN true
        ELSE NOT COALESCE((
          SELECT bool_and(
            jsonb_typeof(topic) = 'string'
            AND length(topic #>> '{}') <= 50
          )
          FROM jsonb_array_elements(p_meta -> 'topics') AS topic
        ), true)
      END THEN false
      WHEN p_meta ? 'stars' AND CASE
        WHEN jsonb_typeof(p_meta -> 'stars') <> 'number' THEN true
        ELSE (p_meta ->> 'stars')::numeric < 0
          OR (p_meta ->> 'stars')::numeric <> trunc((p_meta ->> 'stars')::numeric)
          OR (p_meta ->> 'stars')::numeric > 9007199254740991
      END THEN false
      WHEN p_meta ? 'visibility'
        AND (
          jsonb_typeof(p_meta -> 'visibility') <> 'string'
          OR (p_meta ->> 'visibility') NOT IN ('public', 'private', 'internal')
        )
        THEN false
      WHEN p_meta ? 'updatedAt'
        AND (
          jsonb_typeof(p_meta -> 'updatedAt') <> 'string'
          OR length(p_meta ->> 'updatedAt') > 40
        )
        THEN false
      WHEN p_meta ? 'githubId' AND CASE
        WHEN jsonb_typeof(p_meta -> 'githubId') <> 'number' THEN true
        ELSE (p_meta ->> 'githubId')::numeric <= 0
          OR (p_meta ->> 'githubId')::numeric <> trunc((p_meta ->> 'githubId')::numeric)
          OR (p_meta ->> 'githubId')::numeric > 9007199254740991
      END THEN false
      ELSE true
    END
  $function$;

  SELECT count(*) INTO v_bad_rows
  FROM public.repocard
  WHERE NOT public.repocard_meta_is_display_metadata(meta);

  IF v_bad_rows > 0 THEN
    RAISE EXCEPTION 'repocard.meta is not display metadata'
      USING DETAIL = format(
        '%s rows would be rejected. Clean them before adding repocard_meta_display.',
        v_bad_rows
      );
  END IF;

  ALTER TABLE public.repocard
    ADD CONSTRAINT repocard_meta_display
    CHECK (public.repocard_meta_is_display_metadata(meta));
END
$migration$;
