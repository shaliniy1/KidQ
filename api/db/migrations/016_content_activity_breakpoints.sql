-- Parent-authored, per-content activity breaks. The same shape is copied to a session item
-- so the child player receives the finalized configuration used by the parent.
ALTER TABLE library_items
  ADD COLUMN activity_breakpoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN position integer;

ALTER TABLE session_items
  ADD COLUMN activity_breakpoints jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE library_items
  ADD CONSTRAINT library_activity_breakpoints_array
  CHECK (jsonb_typeof(activity_breakpoints) = 'array');

ALTER TABLE session_items
  ADD CONSTRAINT session_activity_breakpoints_array
  CHECK (jsonb_typeof(activity_breakpoints) = 'array');

-- These are the live, Kid-owned activities currently safe to select in the parent editor.
-- The player only receives IDs from this catalogue; unavailable activities are never selectable.
UPDATE activities SET title = 'Find 3 Colours', instruction = 'Find 3 colours around the room. Tap the sun when you find them.', spoken_instruction = 'Find three colours around the room.', duration_seconds = 45 WHERE key = 'find_three';
UPDATE activities SET title = 'Tree Pose', instruction = 'Stand tall like a tree. Arms up like branches, and sway gently.', spoken_instruction = 'Stand tall like a tree and sway gently.', duration_seconds = 30 WHERE key = 'stand_like_a_tree';
UPDATE activities SET title = 'Breathe with Sun', instruction = 'Take three slow breaths with the sun.', spoken_instruction = 'Take three slow breaths with the sun.', duration_seconds = 30 WHERE key = 'breathe_with_the_sun';
UPDATE activities SET title = 'Firefly Count', instruction = 'Close your eyes and count slowly to ten.', spoken_instruction = 'Close your eyes and count slowly to ten.', duration_seconds = 30 WHERE key = 'count_to_ten';
UPDATE activities SET title = 'Catch the Sun', instruction = 'Keep your head still and follow the sun with your eyes.', spoken_instruction = 'Keep your head still and follow the sun with your eyes.', duration_seconds = 30 WHERE key = 'follow_my_eyes';

INSERT INTO activities (key, title, instruction, spoken_instruction, duration_seconds, activity_type, break_type, variants) VALUES
  ('butterfly_wings', 'Butterfly Wings', 'Flap your arms like butterfly wings.', 'Flap your arms like butterfly wings.', 30, 'BREAK', 'MOVEMENT', '{}'),
  ('puddle_jump', 'Puddle Jump', 'Make three gentle pretend puddle jumps.', 'Make three gentle pretend puddle jumps.', 30, 'BREAK', 'MOVEMENT', '{}'),
  ('cloud_reach', 'Cloud Reach', 'Reach up high to touch a cloud, then float your arms down.', 'Reach up high to touch a cloud, then float your arms down.', 30, 'BREAK', 'MOVEMENT', '{}'),
  ('flower_candle', 'Flower & Candle', 'Smell the flower, then blow the candle out slowly.', 'Smell the flower, then blow the candle out slowly.', 45, 'BREAK', 'QUIET', '{}'),
  ('sleepy_stretch', 'Sleepy Stretch', 'Stretch slowly like a sleepy cat.', 'Stretch slowly like a sleepy cat.', 45, 'BREAK', 'QUIET', '{}')
ON CONFLICT (key) DO UPDATE SET title = EXCLUDED.title, instruction = EXCLUDED.instruction, spoken_instruction = EXCLUDED.spoken_instruction, duration_seconds = EXCLUDED.duration_seconds, break_type = EXCLUDED.break_type;
