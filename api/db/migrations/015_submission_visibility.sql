-- Parent-submitted content is never part of global recommendations by virtue
-- of its submission visibility. PRIVATE remains scoped to its owning parent;
-- PUBLIC_CANDIDATE is an admin-review candidate and is not auto-published.
ALTER TABLE content_submissions
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'PUBLIC_CANDIDATE'
  CHECK (visibility IN ('PRIVATE', 'PUBLIC_CANDIDATE'));

CREATE INDEX IF NOT EXISTS content_submissions_visibility_idx
  ON content_submissions(parent_user_id, visibility, created_at DESC);
