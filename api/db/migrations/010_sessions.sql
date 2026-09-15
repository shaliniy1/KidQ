-- Sessions (docs/recommendation/parent-experience.md §2–5): the queue a child was given for one
-- sitting, built from their parent-approved library, and how each video and the session ended.
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  minutes integer NOT NULL CHECK (minutes BETWEEN 15 AND 180),
  -- The break after each slot, in order: MOVEMENT, QUIET or WIND_DOWN (always last).
  breaks text[] NOT NULL,
  planned_seconds integer NOT NULL CHECK (planned_seconds > 0),
  -- The library couldn't fill the chosen time by this much; the parent is told afterwards.
  short_by_minutes integer NOT NULL DEFAULT 0 CHECK (short_by_minutes >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  outcome text CHECK (outcome IN ('COMPLETED', 'EXITED')),
  CHECK ((ended_at IS NULL) = (outcome IS NULL))
);
CREATE INDEX sessions_child_idx ON sessions(child_profile_id, started_at DESC);

CREATE TABLE session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot >= 1),
  position integer NOT NULL CHECK (position >= 1),
  outcome text CHECK (outcome IN ('COMPLETED', 'SKIPPED', 'EXITED')),
  watched_seconds integer CHECK (watched_seconds IS NULL OR watched_seconds >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, position)
);
CREATE INDEX session_items_content_idx ON session_items(content_item_id);
