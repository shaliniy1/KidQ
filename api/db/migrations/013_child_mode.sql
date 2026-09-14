-- Child mode (design/ prototype, PR #5; decided with Shalini 2026-09-14): the break activities the
-- KidQ Agent hosts, which break each session got, and where a half-watched video stopped.

-- 1. The break library lives in the existing activities table. {variant} in a line is filled at runtime.
--    KidQ owns these rows, so clearing content (TRUNCATE content_items CASCADE in tests or a local
--    reset) must not wipe them: nothing links an activity to a content item yet, so the link goes.
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_content_item_id_fkey;
ALTER TABLE activities
  ADD COLUMN key text UNIQUE,
  ADD COLUMN break_type text CHECK (break_type IN ('MOVEMENT', 'QUIET', 'WIND_DOWN')),
  ADD COLUMN spoken_instruction text,
  ADD COLUMN variants text[] NOT NULL DEFAULT '{}';

INSERT INTO activities (key, title, instruction, spoken_instruction, duration_seconds, activity_type, break_type, variants) VALUES
  ('find_three', 'Find 3 things', 'Find 3 {variant} things! Look around the room. Tap the sun when you find them.',
   'Find 3 {variant} things. Look around the room, and tap the sun when you find them.', 45, 'BREAK', 'MOVEMENT', ARRAY['red', 'blue', 'green']),
  ('stand_like_a_tree', 'Stand like a tree', 'Stand tall like a tree. Arms up like branches, and sway in the wind.',
   'Stand tall like a tree. Put your arms up like branches, and sway gently in the wind.', 30, 'BREAK', 'MOVEMENT', '{}'),
  ('breathe_with_the_sun', 'Breathe with the sun', 'Three big slow breaths with the sun.',
   'Three big slow breaths with the sun.', 30, 'BREAK', 'QUIET', '{}'),
  ('count_to_ten', 'Count to 10', 'Close your eyes and count to 10.',
   'Close your eyes, and count slowly to ten.', 30, 'BREAK', 'QUIET', '{}'),
  ('follow_my_eyes', 'Follow me with your eyes', 'Keep your head still and follow the sun with your eyes.',
   'Keep your head still, and follow the sun with your eyes.', 30, 'BREAK', 'QUIET', '{}'),
  -- The session's final WIND_DOWN is child mode's sunset and all-done ending; its line follows the session's wind-down.
  ('sunset', 'Sunset', 'The sun is going down.', 'The sun is going down.', 60, 'BREAK', 'WIND_DOWN', ARRAY['STANDARD', 'CALM', 'SLEEP'])
ON CONFLICT (key) DO NOTHING;

-- 2. Which activity each break in a session got.
CREATE TABLE session_breaks (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot >= 1),
  activity_id uuid NOT NULL REFERENCES activities(id),
  variant text,
  PRIMARY KEY (session_id, slot)
);

-- 3. Where a half-watched video stopped, so child mode can resume or restart it.
ALTER TABLE session_items ADD COLUMN position_seconds integer CHECK (position_seconds IS NULL OR position_seconds >= 0);
