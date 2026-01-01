-- Add comment_color column to projectinfo table
-- Per-comment color feature: allows individual color settings for each RepoCard comment
-- Issue: https://github.com/laststance/gitbox/issues/XX

-- Add the column with default value
ALTER TABLE projectinfo
ADD COLUMN comment_color TEXT DEFAULT 'primary';

-- Add CHECK constraint to limit valid color values
-- Colors match COMMENT_BORDER_COLORS in CommentDisplay.tsx
ALTER TABLE projectinfo
ADD CONSTRAINT comment_color_check CHECK (
  comment_color IN ('primary', 'blue', 'green', 'amber', 'purple', 'rose', 'cyan', 'neutral')
);

-- Documentation
COMMENT ON COLUMN projectinfo.comment_color IS 'Border color for inline comment display (default: primary)';
