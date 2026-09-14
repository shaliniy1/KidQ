-- Parent Experience spec v5 (docs/recommendation/parent-experience.md, decided with Shalini 2026-09-14).

-- 1. Seven parent categories (Block B) roll up the admin categories. Admins and the AI keep tagging
--    the detailed categories; parents choose from these. Each group says which admin keys it covers.
ALTER TABLE taxonomy_terms DROP CONSTRAINT IF EXISTS taxonomy_terms_kind_check;
ALTER TABLE taxonomy_terms ADD CONSTRAINT taxonomy_terms_kind_check
  CHECK (kind IN ('category', 'interest', 'development_goal', 'regulation_goal', 'language', 'age_group', 'parent_category'));

INSERT INTO taxonomy_terms (kind, key, label, sort_order, active, meta) VALUES
  ('parent_category', 'stories_rhymes', 'Stories & Rhymes', 1, true,
   '{"includes": ["stories", "storybooks"], "development_area": "Language & Literacy", "definition": "Stories, picture books and read-alongs."}'),
  ('parent_category', 'songs_music', 'Songs & Music', 2, true,
   '{"includes": ["music_rhymes"], "development_area": "Aesthetic & Creative", "definition": "Songs, rhymes and music to listen or sing along to."}'),
  ('parent_category', 'numbers_thinking', 'Numbers & Thinking', 3, true,
   '{"includes": ["maths"], "development_area": "Cognitive", "definition": "Counting, shapes, patterns, puzzles and logic."}'),
  ('parent_category', 'our_world', 'Our World', 4, true,
   '{"includes": ["science", "educational", "general_knowledge"], "development_area": "Cognitive / environmental awareness", "definition": "Animals, nature, science and how the world works."}'),
  ('parent_category', 'art_making', 'Art & Making', 5, true,
   '{"includes": ["creative_crafts", "drawing_painting"], "development_area": "Aesthetic & Creative", "definition": "Crafts, drawing and painting."}'),
  ('parent_category', 'move_play', 'Move & Play', 6, true,
   '{"includes": ["activities"], "development_area": "Physical (motor)", "definition": "Movement, dance and active play."}'),
  ('parent_category', 'calm_breathe', 'Calm & Breathe', 7, true,
   '{"includes": ["yoga_movement"], "development_area": "Physical + life-energy (pranik) + emotional regulation", "definition": "Yoga, breathing and calming down."}')
ON CONFLICT DO NOTHING;

-- 2. Animation is a style, not a content type: it stops being a category, and items lose it.
UPDATE taxonomy_terms SET active = false WHERE kind = 'category' AND key = 'animated_videos';
UPDATE content_items
SET categories = array_remove(categories, 'animated_videos'),
    category = CASE WHEN category = 'animated_videos' THEN (array_remove(categories, 'animated_videos'))[1] ELSE category END,
    updated_at = now()
WHERE category = 'animated_videos' OR 'animated_videos' = ANY(categories);

-- Children's chosen categories move to the parent groups that cover them.
UPDATE child_profiles c
SET preferred_categories = ARRAY(
  SELECT DISTINCT t.key FROM taxonomy_terms t, unnest(c.preferred_categories) AS chosen(key)
  WHERE t.kind = 'parent_category' AND t.meta->'includes' ? chosen.key
)
WHERE cardinality(preferred_categories) > 0;
UPDATE child_profiles SET content_mix = 'SURPRISE' WHERE content_mix = 'CHOSEN' AND cardinality(preferred_categories) = 0;

-- 3. Block E break interval, and the remembered session mode (§12.3).
ALTER TABLE child_profiles
  ADD COLUMN break_interval_minutes integer NOT NULL DEFAULT 15 CHECK (break_interval_minutes IN (10, 15, 20)),
  ADD COLUMN session_mode text NOT NULL DEFAULT 'AUTO' CHECK (session_mode IN ('AUTO', 'MORNING', 'DAYTIME', 'BEDTIME'));

-- 4. Which session modes an item suits, tagged once by the AI when it scores the item (or by an admin).
ALTER TABLE content_items
  ADD COLUMN session_modes text[] NOT NULL DEFAULT '{}' CHECK (session_modes <@ ARRAY['MORNING', 'DAYTIME', 'BEDTIME']);

-- 5. Each session keeps its time-of-day context for the handoff log.
ALTER TABLE sessions
  ADD COLUMN mode text NOT NULL DEFAULT 'AUTO' CHECK (mode IN ('AUTO', 'MORNING', 'DAYTIME', 'BEDTIME')),
  ADD COLUMN time_band text CHECK (time_band IN ('MORNING', 'DAYTIME', 'EVENING', 'NIGHT')),
  ADD COLUMN wind_down text NOT NULL DEFAULT 'STANDARD' CHECK (wind_down IN ('STANDARD', 'CALM', 'SLEEP')),
  ADD COLUMN lean_toward text;

-- 6. The card view gains the session modes and the parent categories each item falls under (primary first).
CREATE OR REPLACE VIEW content_records_v WITH (security_invoker = true) AS
SELECT
  ci.id, ci.content_type, ci.title, ci.description, ci.kidq_summary, ci.language, ci.duration_seconds,
  ci.thumbnail_url, ci.age_min, ci.age_max, ci.category, ci.subcategory, ci.learning_objective,
  ci.skills, ci.topics AS interests, ci.keywords, ci.development_goals, ci.regulation_goals,
  ci.classification_source, ci.current_status, ci.analysis_status, ci.kidq_score, ci.kidq_confidence,
  ci.kidq_score_version, ci.has_critical_flag, ci.publish_blockers, ci.published_at, ci.created_at, ci.updated_at,
  CASE
    WHEN ci.current_status = 'APPROVED' THEN 'APPROVED'
    WHEN ci.current_status = 'REJECTED' THEN 'REJECTED'
    WHEN ci.analysis_status IN ('QUEUED', 'ANALYSING') THEN 'PENDING_ANALYSIS'
    WHEN cardinality(ci.publish_blockers) = 0 THEN 'READY_TO_APPROVE'
    ELSE 'NEEDS_ATTENTION'
  END AS studio_state,
  sr.id AS source_record_id, sr.source_system_id AS source, sr.external_id, sr.source_url, sr.embed_url,
  sr.media_url, sr.media_mime_type, sr.thumbnails, sr.creator AS channel_or_creator, sr.caption_available,
  sr.made_for_kids, sr.embeddable, sr.available, sr.fetched_at, sr.last_verified_at,
  ra.license_name, ra.license_url, ra.attribution_text, ra.attribution_required, ra.allows_embedding,
  ra.allows_media_storage, ra.allows_transcript_storage,
  tr.retrieval_status AS transcript_status, tr.transcript_text, tr.origin AS transcript_origin,
  ci.categories, ci.learning_value,
  ci.session_modes,
  ARRAY(
    SELECT t.key FROM taxonomy_terms t
    WHERE t.kind = 'parent_category' AND t.active
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(t.meta->'includes') AS included(key)
        WHERE included.key = ANY(CASE WHEN cardinality(ci.categories) > 0 THEN ci.categories ELSE ARRAY[ci.category] END)
      )
    ORDER BY (t.meta->'includes' ? COALESCE(ci.category, '')) DESC, t.sort_order
  ) AS parent_categories
FROM content_items ci
LEFT JOIN LATERAL (
  SELECT * FROM source_records s WHERE s.content_item_id = ci.id ORDER BY s.fetched_at DESC LIMIT 1
) sr ON true
LEFT JOIN LATERAL (
  SELECT * FROM rights_assertions r WHERE r.source_record_id = sr.id ORDER BY r.checked_at DESC LIMIT 1
) ra ON true
LEFT JOIN LATERAL (
  SELECT * FROM transcripts t WHERE t.source_record_id = sr.id ORDER BY t.created_at DESC LIMIT 1
) tr ON true;
