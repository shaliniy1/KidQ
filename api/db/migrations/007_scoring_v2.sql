-- Scoring v2, RANK_V2 and multi-category items (docs/recommendation/README.md).

-- An item fits up to three categories; the first is its primary one (content_items.category).
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';
UPDATE content_items SET categories = ARRAY[category] WHERE category IS NOT NULL AND cardinality(categories) = 0;
-- Picture books are Storybooks first; a topic the AI or an admin picked stays as a second category.
UPDATE content_items
SET categories = ARRAY['storybooks'] || array_remove(categories, 'storybooks'), category = 'storybooks'
WHERE content_type = 'STORYBOOK' AND category IS DISTINCT FROM 'storybooks';
CREATE INDEX IF NOT EXISTS content_items_categories_idx ON content_items USING gin (categories);

-- Learning value (0–100) from the filter-in criteria, kept in step by rescoring.
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS learning_value smallint
  CHECK (learning_value IS NULL OR learning_value BETWEEN 0 AND 100);

-- One-line category definitions: the AI prompt and the admin show them.
UPDATE taxonomy_terms t SET meta = t.meta || jsonb_build_object('definition', d.definition)
FROM (VALUES
  ('animated_videos', 'Cartoons and animated videos whose main appeal is the animation itself, not a story or a song.'),
  ('stories', 'A story told on video: animated, with puppets, or someone reading or telling it aloud.'),
  ('storybooks', 'Picture books read in the KidQ story reader. Only for books, never for videos.'),
  ('creative_crafts', 'Making things with paper, clay, recycled materials or other simple craft supplies.'),
  ('drawing_painting', 'Drawing, painting, colouring and other art made with pencils, crayons or paint.'),
  ('science', 'Explains how or why things work: space, weather, the human body, life cycles and simple experiments.'),
  ('maths', 'Counting, numbers, shapes, sizes, patterns, sorting and measuring.'),
  ('yoga_movement', 'Yoga, stretching, breathing and calm movement to follow along with.'),
  ('activities', 'Play-along games, movement or dance challenges, and things to do away from the screen.'),
  ('educational', 'Early-learning lessons: letters, phonics, first words, colours, body parts, routines and manners.'),
  ('music_rhymes', 'Songs, nursery rhymes, lullabies and gentle music.'),
  ('general_knowledge', 'Shows and names the real world: animals, nature, vehicles, places, people and jobs.')
) AS d(key, definition)
WHERE t.kind = 'category' AND t.key = d.key;

-- A review from the KidQ expert panel has no public source URL.
ALTER TABLE expert_reviews ALTER COLUMN source_url DROP NOT NULL;

-- Scoring v2 (evidence caps, confidence v2) with the same weights; confidence below 60% needs an admin.
INSERT INTO scoring_configs (version, weights, source_reliability, min_ai_confidence, active, created_by)
SELECT 'KIDQ_SCORE_V' || (SELECT max(substring(version FROM '_V([0-9]+)$')::int) + 1 FROM scoring_configs),
       weights, source_reliability, 0.6, false, 'migration 007'
FROM scoring_configs WHERE active;
UPDATE scoring_configs SET active = false WHERE active;
UPDATE scoring_configs SET active = true WHERE created_by = 'migration 007';

-- RANK_V2: learning value joins the ranking; "preference" becomes fit (age and session length).
INSERT INTO ranking_configs (version, weights, params, active, created_by)
SELECT 'RANK_V' || (SELECT max(substring(version FROM '_V([0-9]+)$')::int) + 1 FROM ranking_configs),
       '{"relevance": 0.40, "score": 0.25, "learning": 0.15, "expert": 0.10, "preference": 0.10}', params, false, 'migration 007'
FROM ranking_configs WHERE active;
UPDATE ranking_configs SET active = false WHERE active;
UPDATE ranking_configs SET active = true WHERE created_by = 'migration 007';

-- The view gains the new columns (appended, as CREATE OR REPLACE VIEW requires).
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
    WHEN ci.analysis_status = 'QUEUED' THEN 'PENDING_ANALYSIS'
    WHEN ci.analysis_status = 'ANALYSING' THEN 'ANALYSING'
    WHEN cardinality(ci.publish_blockers) = 0 THEN 'READY_TO_APPROVE'
    WHEN ci.analysis_status = 'FAILED' THEN 'FAILED'
    WHEN ci.analysis_status = 'ANALYSIS_INCOMPLETE' THEN 'ANALYSIS_INCOMPLETE'
    ELSE 'NEEDS_ATTENTION'
  END AS studio_state,
  sr.id AS source_record_id, sr.source_system_id AS source, sr.external_id, sr.source_url, sr.embed_url,
  sr.media_url, sr.media_mime_type, sr.thumbnails, sr.creator AS channel_or_creator, sr.caption_available,
  sr.made_for_kids, sr.embeddable, sr.available, sr.fetched_at, sr.last_verified_at,
  ra.license_name, ra.license_url, ra.attribution_text, ra.attribution_required, ra.allows_embedding,
  ra.allows_media_storage, ra.allows_transcript_storage,
  tr.retrieval_status AS transcript_status, tr.transcript_text, tr.origin AS transcript_origin,
  ci.categories, ci.learning_value
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

-- Rescore everything under the new version once a worker picks this up.
INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, priority, dedupe_key, available_at)
VALUES ('system', '00000000-0000-0000-0000-000000000000', 'RESCORE_ALL', '{}', 1, 'rescore_all', now())
ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('PENDING', 'PROCESSING') DO NOTHING;
