-- Parent Analytics (docs/api/README.md "Analytics"): privacy-minimal viewing events and a per-play
-- rollup the analytics page reads. No IP, user agent, advertising ID or free text about the child.

-- The parent's time zone decides a child's "today" and the part of the day (morning, afternoon, evening).
ALTER TABLE parent_profiles ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';

CREATE TABLE analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  -- Made by the app; a resent batch is a no-op.
  client_event_id uuid NOT NULL,
  event_name text NOT NULL CHECK (event_name IN (
    'video_started', 'video_progress', 'video_paused', 'video_resumed', 'video_completed', 'video_exited', 'video_replayed',
    'content_clicked', 'recommendation_clicked', 'session_started', 'session_ended', 'activity_started', 'activity_completed'
  )),
  -- One playback of one video or activity, from start to exit.
  play_id uuid,
  content_item_id uuid REFERENCES content_items(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  session_id uuid,
  -- Snapshotted, so re-categorising an item later doesn't rewrite history.
  category text,
  -- Time actually playing and on screen since the play's previous event, after the server's caps.
  active_seconds double precision NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  position_seconds double precision CHECK (position_seconds IS NULL OR position_seconds >= 0),
  progress_percent double precision CHECK (progress_percent IS NULL OR progress_percent BETWEEN 0 AND 100),
  recommendation_source text CHECK (recommendation_source IN ('PARENT_PLAYLIST', 'KIDQ_RECOMMENDATION', 'CATEGORY_BROWSE', 'CONTINUE_WATCHING', 'RECENTLY_WATCHED')),
  device_type text CHECK (device_type IN ('PHONE', 'TABLET', 'TV', 'DESKTOP')),
  -- Allow-listed per event by the API schema.
  metadata jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_profile_id, client_event_id)
);
CREATE INDEX analytics_events_child_idx ON analytics_events(child_profile_id, occurred_at DESC);
CREATE INDEX analytics_events_occurred_idx ON analytics_events(occurred_at);

-- The rollup: one row per play, updated with each event. Every analytics section is a GROUP BY over it.
CREATE TABLE child_plays (
  play_id uuid PRIMARY KEY,
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('VIDEO', 'ACTIVITY')),
  -- A content item for a video, an activity for an activity.
  item_id uuid NOT NULL,
  category text,
  -- The parent's local day the play started.
  day date NOT NULL,
  duration_seconds integer,
  active_seconds double precision NOT NULL DEFAULT 0,
  morning_seconds double precision NOT NULL DEFAULT 0,
  afternoon_seconds double precision NOT NULL DEFAULT 0,
  evening_seconds double precision NOT NULL DEFAULT 0,
  other_seconds double precision NOT NULL DEFAULT 0,
  max_progress double precision NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL,
  last_event_at timestamptz NOT NULL
);
CREATE INDEX child_plays_child_day_idx ON child_plays(child_profile_id, day);
