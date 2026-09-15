-- Recommend strictly from the child's age bucket (Shalini, 2026-09-15). `content_items.age_bands`
-- has been correctly maintained since 006_onboarding.sql, but content_records_v never selected it, so
-- the recommendation engine fell back to a continuous estimated-age comparison instead of the bucket
-- it was supposedly built from. This exposes the bucket; api/src/domain/recommendation/index.ts is the
-- change that actually gates on it.

-- 1. Safety backfill: anything with age_min/age_max set but no bucket yet (should be none, given the
--    006 backfill and every classification write since, but this is cheap insurance).
UPDATE content_items SET age_bands = ARRAY(
    SELECT band.key FROM (VALUES ('0_2', 0, 2), ('2_3', 2, 3), ('3_4', 3, 4), ('4_5', 4, 5), ('5_6', 5, 6)) AS band(key, lo, hi)
    WHERE (age_min < band.hi AND age_max > band.lo) OR (age_min = age_max AND age_min >= band.lo AND age_min <= band.hi)
    ORDER BY band.lo)
WHERE age_min IS NOT NULL AND age_max IS NOT NULL AND cardinality(age_bands) = 0;

-- 2. Expose the bucket to every card and recommendation query.
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
  ) AS parent_categories,
  -- CREATE OR REPLACE VIEW can only append columns, never insert one among the existing ones — the
  -- bucket goes last.
  ci.age_bands
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
