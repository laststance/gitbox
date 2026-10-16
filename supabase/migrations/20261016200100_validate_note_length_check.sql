-- Validate note_length_check outside the migration that added it.
--
-- Adding the check and scanning every row in one transaction holds the lock
-- that blocks writes for the whole scan. NOT VALID already refuses a new
-- note that is too long. This scan allows reads and writes. Existing rows
-- passed length(note) <= 20000, and the text is never longer than the
-- document, so the scan accepts them.

ALTER TABLE public.projectinfo VALIDATE CONSTRAINT note_length_check;
