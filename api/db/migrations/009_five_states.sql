-- Five studio states (decided with Shalini, 2026-09-13). ANALYSING folds into PENDING_ANALYSIS (it
-- lasts seconds); ANALYSIS_INCOMPLETE and FAILED fold into NEEDS_ATTENTION (both mean an admin must
-- act; analysis_status still says which). Only the CASE changes.
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
