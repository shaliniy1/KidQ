-- Parent onboarding (P2 revision, docs/recommendation/parent-onboarding.md) and one vocabulary for
-- admin tagging and onboarding (architecture doc §9): five age bands and the twelve onboarding
-- categories. Retired terms stay inactive for history; content and preferences move to the new keys.

-- 1. Age bands: 0–2, 2–3, 3–4, 4–5, 5–6.
UPDATE taxonomy_terms SET active = false WHERE kind = 'age_group' AND key IN ('2_4', '4_6');
INSERT INTO taxonomy_terms (kind, key, label, sort_order, meta) VALUES
  ('age_group', '2_3', '2–3 years', 2, '{"min": 2, "max": 3}'),
  ('age_group', '3_4', '3–4 years', 3, '{"min": 3, "max": 4}'),
  ('age_group', '4_5', '4–5 years', 4, '{"min": 4, "max": 5}'),
  ('age_group', '5_6', '5–6 years', 5, '{"min": 5, "max": 6}')
ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, meta = EXCLUDED.meta, active = true;

UPDATE content_items SET age_bands = ARRAY(
    SELECT band.key FROM (VALUES ('0_2', 0, 2), ('2_3', 2, 3), ('3_4', 3, 4), ('4_5', 4, 5), ('5_6', 5, 6)) AS band(key, lo, hi)
    WHERE (age_min < band.hi AND age_max > band.lo) OR (age_min = age_max AND age_min >= band.lo AND age_min <= band.hi)
    ORDER BY band.lo)
WHERE age_min IS NOT NULL AND age_max IS NOT NULL;

-- 2. Categories: the twelve onboarding chips, reusing keys where the concept matches.
INSERT INTO taxonomy_terms (kind, key, label, sort_order) VALUES
  ('category', 'stories', 'Stories', 2),
  ('category', 'educational', 'Educational', 10)
ON CONFLICT (kind, key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, active = true;

UPDATE taxonomy_terms AS term SET label = chip.label, sort_order = chip.sort_order, active = true
FROM (VALUES
  ('animated_videos', 'Animation', 1),
  ('storybooks', 'Storybooks', 3),
  ('creative_crafts', 'Crafts', 4),
  ('drawing_painting', 'Painting', 5),
  ('science', 'Science', 6),
  ('maths', 'Maths', 7),
  ('yoga_movement', 'Yoga', 8),
  ('activities', 'Activities', 9),
  ('music_rhymes', 'Music / Rhymes', 11),
  ('general_knowledge', 'Knowledge / General Learning', 12)
) AS chip(key, label, sort_order)
WHERE term.kind = 'category' AND term.key = chip.key;

UPDATE taxonomy_terms SET active = false
WHERE kind = 'category' AND key IN ('animals_nature', 'baby_learning', 'trusted_educators', 'games_play_along', 'creativity');

-- Content and parents' choices move off the retired categories.
UPDATE content_items SET updated_at = now(), category = CASE category
    WHEN 'animals_nature' THEN 'general_knowledge'
    WHEN 'games_play_along' THEN 'activities'
    WHEN 'creativity' THEN 'creative_crafts'
    ELSE 'educational' END
WHERE category IN ('animals_nature', 'baby_learning', 'trusted_educators', 'games_play_along', 'creativity');

-- "Stories" are story videos; "Storybooks" are picture books read in the KidQ reader.
UPDATE content_items SET category = 'stories', updated_at = now() WHERE category = 'storybooks' AND content_type <> 'STORYBOOK';

UPDATE child_profiles SET preferred_categories = ARRAY(
    SELECT DISTINCT CASE chosen
      WHEN 'animals_nature' THEN 'general_knowledge'
      WHEN 'baby_learning' THEN 'educational'
      WHEN 'trusted_educators' THEN 'educational'
      WHEN 'games_play_along' THEN 'activities'
      WHEN 'creativity' THEN 'creative_crafts'
      ELSE chosen END
    FROM unnest(preferred_categories) AS chosen)
WHERE preferred_categories && ARRAY['animals_nature', 'baby_learning', 'trusted_educators', 'games_play_along', 'creativity'];

-- 3. Regulation goals keep their keys; parents see the onboarding wording (Block D).
UPDATE taxonomy_terms AS term SET meta = term.meta || jsonb_build_object('parent_label', wording.parent_label)
FROM (VALUES
  ('calm', 'Help them calm down'),
  ('emotional_regulation', 'Manage big feelings'),
  ('focus', 'Build focus'),
  ('movement', 'Burn off energy'),
  ('relaxation', 'Wind down before bed'),
  ('social_regulation', 'Play nicely with others')
) AS wording(key, parent_label)
WHERE term.kind = 'regulation_goal' AND term.key = wording.key;

-- 4. The parent's own profile: their name (Screen 1) and the language they chose.
CREATE TABLE parent_profiles (
  parent_user_id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Child profiles: an age band instead of a birth date (DPDP minimisation), plus the Customize blocks.
ALTER TABLE child_profiles
  ALTER COLUMN birth_year DROP NOT NULL,
  ALTER COLUMN birth_month DROP NOT NULL,
  ADD COLUMN age_band text CHECK (age_band IN ('0_2', '2_3', '3_4', '4_5', '5_6')),
  ADD COLUMN age_band_set_on date NOT NULL DEFAULT current_date,
  ADD COLUMN content_mix text NOT NULL DEFAULT 'SURPRISE' CHECK (content_mix IN ('SURPRISE', 'CHOSEN')),
  ADD COLUMN session_minutes integer NOT NULL DEFAULT 30 CHECK (session_minutes IN (15, 30, 45, 60, 90)),
  ADD COLUMN break_type text NOT NULL DEFAULT 'ALTERNATE' CHECK (break_type IN ('MOVEMENT', 'QUIET', 'ALTERNATE')),
  ADD COLUMN development_goals_custom boolean NOT NULL DEFAULT false;

-- Existing profiles: today's band from the birth date; goals and categories they set count as their own.
UPDATE child_profiles AS child SET
  age_band = CASE
    WHEN age.months IS NULL THEN '3_4'
    WHEN age.months < 24 THEN '0_2'
    WHEN age.months < 36 THEN '2_3'
    WHEN age.months < 48 THEN '3_4'
    WHEN age.months < 60 THEN '4_5'
    ELSE '5_6' END,
  development_goals_custom = cardinality(child.development_goals) > 0,
  content_mix = CASE WHEN cardinality(child.preferred_categories) > 0 THEN 'CHOSEN' ELSE 'SURPRISE' END
FROM (
  SELECT id, (extract(year FROM current_date)::int - birth_year) * 12 + extract(month FROM current_date)::int - birth_month AS months
  FROM child_profiles
) AS age
WHERE age.id = child.id;

ALTER TABLE child_profiles ALTER COLUMN age_band SET NOT NULL;
