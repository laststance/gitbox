-- ============================================================================
-- Count a note the way the Note dialog counts it
-- ============================================================================
--
-- note_length_check used to be length(note) <= 20000, the stored editor
-- document. The dialog counts the text (getSlateTextLength, NOTE_MAX_LENGTH)
-- and stops at 20,000 characters. The document is longer than that text:
-- every paragraph and mark is markup. A note of about 15,000 characters was
-- refused, and the toast did not say why.
--
-- The check is now the text length, through projectinfo_slate_text, which
-- already reads a document the way the dialog does. The stored document may
-- be longer. 2,000,000 characters is the cap for that markup: 20,000
-- one-character paragraphs are about 860,000, and the extra room is for
-- marks. A document past that cap is refused even when its text is short.
--
-- Existing rows already satisfy length(note) <= 20000, and the text of a
-- document is never longer than the document, so this check accepts every
-- row the old one did. It reads no table. Re-runnable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.projectinfo_note_text_length(p_note text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  trimmed text;
  parsed jsonb;
BEGIN
  IF p_note IS NULL OR p_note = '' THEN
    RETURN 0;
  END IF;

  trimmed := btrim(p_note);

  -- The Note dialog stores a JSON array. Anything else is legacy plain text.
  -- getSlateTextLength does not count the newlines between those lines.
  IF left(trimmed, 1) = '[' THEN
    BEGIN
      parsed := trimmed::jsonb;
    EXCEPTION
      WHEN others THEN
        RETURN length(replace(p_note, E'\n', ''));
    END;

    IF jsonb_typeof(parsed) = 'array' AND jsonb_array_length(parsed) > 0 THEN
      BEGIN
        -- Separator '' matches getSlateTextLength: a newline between blocks
        -- is not a character of the note.
        RETURN length(public.projectinfo_slate_text(parsed, ''));
      EXCEPTION
        WHEN others THEN
          RETURN length(replace(p_note, E'\n', ''));
      END;
    END IF;
  END IF;

  RETURN length(replace(p_note, E'\n', ''));
END;
$function$;

ALTER TABLE public.projectinfo DROP CONSTRAINT IF EXISTS note_length_check;

ALTER TABLE public.projectinfo
  ADD CONSTRAINT note_length_check CHECK (
    note IS NULL
    OR (
      length(note) <= 2000000
      AND public.projectinfo_note_text_length(note) <= 20000
    )
  );

COMMENT ON CONSTRAINT note_length_check ON public.projectinfo IS
  'The text of a note is at most 20,000 characters, the same count as the Note dialog. The stored editor document may be longer, up to 2,000,000 characters.';

REVOKE ALL ON FUNCTION public.projectinfo_note_text_length(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projectinfo_note_text_length(text)
  TO authenticated, service_role;

-- The length check calls projectinfo_slate_text as the writer. service_role
-- writes rows in tests and must be able to evaluate the check.
GRANT EXECUTE ON FUNCTION public.projectinfo_slate_text(jsonb, text)
  TO service_role;

-- The same counts as getSlateTextLength. A function that drifts fails here,
-- before the migration is recorded.
DO $check$
DECLARE
  long_document text;
  long_text text;
BEGIN
  long_document :=
    '[{"type":"p","padding":"'
    || repeat('x', 20000)
    || '","children":[{"text":"hi"}]}]';
  long_text :=
    '[{"type":"p","children":[{"text":"'
    || repeat('y', 20001)
    || '"}]}]';

  IF public.projectinfo_note_text_length(NULL) IS DISTINCT FROM 0
    OR public.projectinfo_note_text_length('') IS DISTINCT FROM 0
    OR public.projectinfo_note_text_length(E'Hello\nWorld') IS DISTINCT FROM 10
    OR public.projectinfo_note_text_length(
      '[{"type":"p","children":[{"text":"Hello"}]}]'
    ) IS DISTINCT FROM 5
    OR public.projectinfo_note_text_length(
      '[{"type":"p","children":[{"text":"Hello"}]},{"type":"p","children":[{"text":"World"}]}]'
    ) IS DISTINCT FROM 10
    OR length(long_document) <= 20000
    OR public.projectinfo_note_text_length(long_document) IS DISTINCT FROM 2
    OR public.projectinfo_note_text_length(long_text) IS DISTINCT FROM 20001
  THEN
    RAISE EXCEPTION 'projectinfo_note_text_length disagrees with getSlateTextLength'
      USING DETAIL = 'note_length_check would not match the Note dialog.';
  END IF;
END;
$check$;
