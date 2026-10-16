-- ============================================================================
-- Marks for the Add Repositories picker, without the note body
-- ============================================================================
--
-- lookupSavedRepositoryMemories used to select the note (up to 20,000
-- characters), the links and the comment of every row, only to decide three
-- values: whether the note has text, how many links have a URL, and whether
-- the comment has text. The view below answers those three. The note stays
-- in the database.
--
-- A note is the Note dialog's editor document. projectinfo_note_holds_text
-- decides "has text" the way noteHoldsText does (src/lib/actions/
-- saved-repository-memories.ts, which calls isSlateValueEmpty): an emptied
-- document is not a note, plain text is, and a value that is not a document
-- (an array of numbers, JSON that does not parse) counts by its raw text
-- instead of failing the read. projectinfo_link_count follows
-- countLinksWithUrl: the array form, and the legacy production / tracking /
-- supabase form. A legacy value that function cannot read counts as no links.
--
-- The view keeps repositories that sit on a board out. Their memory shows on
-- the card, not as a Saved mark. It also keeps rows that hold nothing, so
-- the picker does not page through them.
--
-- security_invoker: the view reads projectinfo and repocard with the
-- caller's rights, so the policies on those tables apply. Without it the
-- view would run as its owner and ignore the policies.
--
-- The checks at the bottom refuse a function that disagrees with those
-- rules. They read no table. Re-runnable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.projectinfo_slate_text(
  p_nodes jsonb,
  p_separator text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  node jsonb;
  piece text;
  parts text[] := ARRAY[]::text[];
BEGIN
  -- The editor document is an array. Anything else is the odd shape that
  -- noteHoldsText catches and treats as raw text.
  IF jsonb_typeof(p_nodes) <> 'array' THEN
    RAISE EXCEPTION 'slate value is not an array';
  END IF;

  FOR node IN SELECT value FROM jsonb_array_elements(p_nodes)
  LOOP
    IF jsonb_typeof(node) <> 'object' THEN
      RAISE EXCEPTION 'slate node is not an object';
    END IF;

    -- A text node wins over children, as isTextNode does.
    IF jsonb_typeof(node -> 'text') = 'string' THEN
      piece := node ->> 'text';
    ELSIF jsonb_typeof(node -> 'children') = 'array' THEN
      piece := public.projectinfo_slate_text(node -> 'children', '');
    ELSE
      piece := '';
    END IF;

    parts := array_append(parts, piece);
  END LOOP;

  RETURN coalesce(array_to_string(parts, p_separator), '');
END;
$function$;

CREATE OR REPLACE FUNCTION public.projectinfo_note_holds_text(p_note text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  trimmed text;
  parsed jsonb;
  extracted text;
BEGIN
  IF p_note IS NULL OR btrim(p_note) = '' THEN
    RETURN false;
  END IF;

  trimmed := btrim(p_note);

  -- The Note dialog stores a JSON array. Anything else is legacy plain text.
  IF left(trimmed, 1) = '[' THEN
    BEGIN
      parsed := trimmed::jsonb;
    EXCEPTION
      WHEN others THEN
        RETURN true;
    END;

    IF jsonb_typeof(parsed) = 'array' AND jsonb_array_length(parsed) > 0 THEN
      BEGIN
        extracted := public.projectinfo_slate_text(parsed, E'\n');
      EXCEPTION
        WHEN others THEN
          -- One odd node: the app's catch counts the raw text, which is
          -- non-blank or this branch would not be running.
          RETURN true;
      END;
      RETURN btrim(extracted) <> '';
    END IF;
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.projectinfo_link_count(p_links jsonb)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  n integer := 0;
  key text;
  bucket jsonb;
  elem jsonb;
BEGIN
  IF p_links IS NULL THEN
    RETURN 0;
  END IF;

  -- The form the Note dialog stores: [{ "type", "url" }, ...]
  IF jsonb_typeof(p_links) = 'array' THEN
    -- `link` is the row alias. A variable of that name would hide the column.
    SELECT count(*)::integer INTO n
    FROM jsonb_array_elements(p_links) AS link
    WHERE jsonb_typeof(link.value) = 'object'
      AND jsonb_typeof(link.value -> 'type') = 'string'
      AND jsonb_typeof(link.value -> 'url') = 'string'
      AND btrim(link.value ->> 'url') <> '';
    RETURN n;
  END IF;

  IF jsonb_typeof(p_links) <> 'object' THEN
    RETURN 0;
  END IF;

  -- The legacy form: { "production": ["https://..."], "tracking": [], "supabase": [] }
  -- A bucket that is not an array, or a URL that is not a string, makes
  -- countLinksWithUrl throw and count none of the links.
  FOREACH key IN ARRAY ARRAY['production', 'tracking', 'supabase']
  LOOP
    IF NOT (p_links ? key) THEN
      CONTINUE;
    END IF;

    bucket := p_links -> key;
    IF jsonb_typeof(bucket) <> 'array' THEN
      RETURN 0;
    END IF;

    FOR elem IN SELECT value FROM jsonb_array_elements(bucket)
    LOOP
      IF jsonb_typeof(elem) <> 'string' THEN
        RETURN 0;
      END IF;
      IF btrim(elem #>> '{}') <> '' THEN
        n := n + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN n;
END;
$function$;

DROP VIEW IF EXISTS public.saved_repository_mark;

CREATE VIEW public.saved_repository_mark
WITH (security_invoker = true) AS
SELECT
  mark.id,
  mark.user_id,
  mark.repo_owner,
  mark.repo_name,
  mark.has_note,
  mark.link_count,
  mark.has_comment
FROM (
  SELECT
    p.id,
    p.user_id,
    p.repo_owner,
    p.repo_name,
    public.projectinfo_note_holds_text(p.note) AS has_note,
    public.projectinfo_link_count(p.links) AS link_count,
    (p.comment IS NOT NULL AND btrim(p.comment) <> '') AS has_comment
  FROM public.projectinfo p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.repocard r
    WHERE r.user_id = p.user_id
      AND lower(r.repo_owner) = lower(p.repo_owner)
      AND lower(r.repo_name) = lower(p.repo_name)
  )
) AS mark
WHERE mark.has_note OR mark.link_count > 0 OR mark.has_comment;

REVOKE ALL ON FUNCTION public.projectinfo_slate_text(jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projectinfo_slate_text(jsonb, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.projectinfo_note_holds_text(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projectinfo_note_holds_text(text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.projectinfo_link_count(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projectinfo_link_count(jsonb)
  TO authenticated;

REVOKE ALL ON TABLE public.saved_repository_mark FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.saved_repository_mark TO authenticated;

-- The same cases as summarizeMemoryRow. A function that drifts fails here,
-- before the migration is recorded.
DO $check$
BEGIN
  IF public.projectinfo_note_holds_text(NULL) IS DISTINCT FROM false
    OR public.projectinfo_note_holds_text('   ') IS DISTINCT FROM false
    OR public.projectinfo_note_holds_text(
      '[{"type":"p","children":[{"text":""}]}]'
    ) IS DISTINCT FROM false
    OR public.projectinfo_note_holds_text(
      '[{"type":"p","children":[{"text":"   "}]}]'
    ) IS DISTINCT FROM false
    OR public.projectinfo_note_holds_text(
      '[{"type":"p","children":[{"text":"Release with pnpm release"}]}]'
    ) IS DISTINCT FROM true
    OR public.projectinfo_note_holds_text('[1]') IS DISTINCT FROM true
    OR public.projectinfo_note_holds_text('CLI tool documentation')
      IS DISTINCT FROM true
    OR public.projectinfo_note_holds_text('[]') IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'projectinfo_note_holds_text disagrees with noteHoldsText'
      USING DETAIL = 'The picker mark for a note would not match the Note dialog.';
  END IF;

  IF public.projectinfo_link_count(NULL) IS DISTINCT FROM 0
    OR public.projectinfo_link_count('{}'::jsonb) IS DISTINCT FROM 0
    OR public.projectinfo_link_count('[]'::jsonb) IS DISTINCT FROM 0
    OR public.projectinfo_link_count(
      '[{"type":"vercel","url":" "}]'::jsonb
    ) IS DISTINCT FROM 0
    OR public.projectinfo_link_count(
      '[{"type":"npm","url":"https://www.npmjs.com/package/nsx"}]'::jsonb
    ) IS DISTINCT FROM 1
    OR public.projectinfo_link_count(
      '{"production":[5]}'::jsonb
    ) IS DISTINCT FROM 0
    OR public.projectinfo_link_count(
      '{"production":["https://nsx.example.com"],"tracking":["https://sentry.example.com"]}'::jsonb
    ) IS DISTINCT FROM 2
  THEN
    RAISE EXCEPTION 'projectinfo_link_count disagrees with countLinksWithUrl'
      USING DETAIL = 'The picker mark for links would not match the Note dialog.';
  END IF;
END
$check$;
