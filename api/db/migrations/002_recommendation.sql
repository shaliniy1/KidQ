-- 002_recommendation: KidQ content score, AI/admin assessments, admin controls, taxonomy,
-- recommendation config, parent profiles and libraries.
-- Spec: docs/recommendation/README.md (reconciled with docs/content-curation/README.md).

INSERT INTO source_systems (id, name, base_url, connector_version) VALUES
  ('youtube', 'YouTube Data API v3', 'https://www.googleapis.com/youtube/v3', '2'),
  ('nasa_images', 'NASA Image and Video Library', 'https://images-api.nasa.gov', '1'),
  ('wikimedia_commons', 'Wikimedia Commons Action API', 'https://commons.wikimedia.org/w/api.php', '1')
ON CONFLICT (id) DO NOTHING;

-- Ingestion runs are created before the source is called (202 Accepted), so they start QUEUED.
ALTER TABLE ingestion_runs DROP CONSTRAINT ingestion_runs_status_check;
ALTER TABLE ingestion_runs
  ADD CONSTRAINT ingestion_runs_status_check CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')),
  ADD COLUMN connector_version text,
  ADD COLUMN records_unchanged integer NOT NULL DEFAULT 0,
  ADD COLUMN records_rejected_before_ai integer NOT NULL DEFAULT 0,
  ADD COLUMN cursor jsonb,
  ADD COLUMN requested_by text;

-- Canonical content: pipeline state, editorial and classification fields, score projection.
ALTER TABLE content_items
  ADD COLUMN analysis_status text NOT NULL DEFAULT 'QUEUED'
    CHECK (analysis_status IN ('QUEUED', 'ANALYSING', 'ASSESSED', 'ANALYSIS_INCOMPLETE', 'FAILED')),
  ADD COLUMN kidq_summary text,
  ADD COLUMN development_goals text[] NOT NULL DEFAULT '{}',
  ADD COLUMN regulation_goals text[] NOT NULL DEFAULT '{}',
  ADD COLUMN classification_source text CHECK (classification_source IN ('RULE', 'MODEL', 'HUMAN')),
  ADD COLUMN kidq_score numeric(5,2) CHECK (kidq_score IS NULL OR kidq_score BETWEEN 0 AND 100),
  ADD COLUMN kidq_confidence numeric(4,3) CHECK (kidq_confidence IS NULL OR kidq_confidence BETWEEN 0 AND 1),
  ADD COLUMN kidq_score_version text,
  ADD COLUMN has_critical_flag boolean NOT NULL DEFAULT false,
  -- Why the item cannot be published yet; empty means "Ready to approve". Maintained by the API.
  ADD COLUMN publish_blockers text[] NOT NULL DEFAULT '{NOT_SCORED}',
  ADD COLUMN published_at timestamptz;

ALTER TABLE source_records
  ADD COLUMN media_url text,
  ADD COLUMN media_mime_type text,
  ADD COLUMN thumbnails jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN available boolean NOT NULL DEFAULT true;

-- No automated assessor may ever produce an approval (content-curation README).
ALTER TABLE assessments
  ADD COLUMN classification jsonb,
  ADD COLUMN output jsonb,
  ADD COLUMN cache_key text,
  ADD CONSTRAINT assessments_no_automated_approval CHECK (assessor_type = 'HUMAN' OR result <> 'APPROVED');

ALTER TABLE assessment_criteria
  ADD COLUMN timestamps text[] NOT NULL DEFAULT '{}';

-- Raw component values per assessment, so weights can change later (scoring MD §6).
CREATE TABLE assessment_scores (
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  component text NOT NULL CHECK (component IN ('CONTENT_LANGUAGE', 'PACING', 'VISUAL_COMFORT', 'AUDIO_COMFORT')),
  value numeric(5,2) CHECK (value IS NULL OR value BETWEEN 0 AND 100),
  status text NOT NULL CHECK (status IN ('MEASURED', 'UNAVAILABLE')),
  self_confidence numeric(4,3) CHECK (self_confidence IS NULL OR self_confidence BETWEEN 0 AND 1),
  evidence text NOT NULL,
  timestamps text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (assessment_id, component),
  CHECK ((status = 'MEASURED') = (value IS NOT NULL))
);

-- Only an admin can approve; the system may only take content down (e.g. video removed at source).
ALTER TABLE publication_decisions
  ADD COLUMN decided_by_user_id uuid,
  ADD COLUMN decision_source text NOT NULL DEFAULT 'ADMIN' CHECK (decision_source IN ('ADMIN', 'SYSTEM')),
  ADD COLUMN overrode_critical_flag boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT publication_decisions_admin_approval CHECK (decision_source = 'ADMIN' OR decision <> 'APPROVED');

CREATE TABLE editorial_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  changes jsonb NOT NULL,
  edited_by text NOT NULL,
  edited_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expert_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL,
  reviewer_type text NOT NULL,
  credentials text,
  recommendation text NOT NULL CHECK (recommendation IN ('RECOMMEND', 'NOT_RECOMMEND')),
  recommended_age_min numeric(3,1) CHECK (recommended_age_min IS NULL OR recommended_age_min BETWEEN 0 AND 6),
  recommended_age_max numeric(3,1) CHECK (recommended_age_max IS NULL OR recommended_age_max BETWEEN 0 AND 6),
  comments text,
  source_url text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scoring_configs (
  version text PRIMARY KEY,
  weights jsonb NOT NULL,
  source_reliability jsonb NOT NULL,
  min_ai_confidence numeric(4,3) NOT NULL DEFAULT 0.5,
  active boolean NOT NULL DEFAULT false,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX scoring_configs_one_active ON scoring_configs(active) WHERE active;
INSERT INTO scoring_configs (version, weights, source_reliability, active) VALUES (
  'KIDQ_SCORE_V1',
  '{"CONTENT_LANGUAGE": 0.40, "PACING": 0.25, "VISUAL_COMFORT": 0.20, "AUDIO_COMFORT": 0.15}',
  '{"HUMAN": 1.0, "MODEL": 0.8, "RULE": 0.5}',
  true
);

CREATE TABLE kidq_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  scoring_version text NOT NULL REFERENCES scoring_configs(version),
  score numeric(5,2) CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  components jsonb NOT NULL,
  missing text[] NOT NULL DEFAULT '{}',
  blocked_by_safety boolean NOT NULL DEFAULT false,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ranking_configs (
  version text PRIMARY KEY,
  weights jsonb NOT NULL,
  params jsonb NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ranking_configs_one_active ON ranking_configs(active) WHERE active;
INSERT INTO ranking_configs (version, weights, params, active) VALUES (
  'RANK_V1',
  '{"relevance": 0.45, "score": 0.35, "expert": 0.10, "preference": 0.10}',
  '{"relevance_weights": {"interests": 0.4, "development_goals": 0.3, "regulation_goals": 0.2, "category": 0.1},
    "max_per_creator_in_top": 3, "top_window": 20, "dismiss_cooldown_days": 14, "expert_neutral": 0.5}',
  true
);

-- One controlled vocabulary shared by admin tagging and parent onboarding.
CREATE TABLE taxonomy_terms (
  kind text NOT NULL CHECK (kind IN ('category', 'interest', 'development_goal', 'regulation_goal', 'language', 'age_group')),
  key text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  meta jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (kind, key)
);
INSERT INTO taxonomy_terms (kind, key, label, sort_order, meta) VALUES
  ('age_group', '0_2', '0–2 years', 1, '{"min": 0, "max": 2}'),
  ('age_group', '2_4', '2–4 years', 2, '{"min": 2, "max": 4}'),
  ('age_group', '4_6', '4–6 years', 3, '{"min": 4, "max": 6}');
INSERT INTO taxonomy_terms (kind, key, label, sort_order) VALUES
  ('category', 'animated_videos', 'Animated Videos', 1),
  ('category', 'storybooks', 'Storybooks / Read-Alouds', 2),
  ('category', 'creative_crafts', 'Creative Crafts', 3),
  ('category', 'drawing_painting', 'Drawing & Painting', 4),
  ('category', 'science', 'Science', 5),
  ('category', 'maths', 'Maths', 6),
  ('category', 'baby_learning', 'Baby Learning', 7),
  ('category', 'general_knowledge', 'General Knowledge', 8),
  ('category', 'games_play_along', 'Games / Play-Along', 9),
  ('category', 'yoga_movement', 'Yoga & Movement', 10),
  ('category', 'animals_nature', 'Animals / Nature / Guppy Videos', 11),
  ('category', 'trusted_educators', 'Trusted Educators', 12),
  ('category', 'activities', 'Activities', 13),
  ('category', 'music_rhymes', 'Music / Rhymes', 14),
  ('category', 'creativity', 'Creativity', 15),
  ('interest', 'animals', 'Animals', 1),
  ('interest', 'nature', 'Nature & plants', 2),
  ('interest', 'space', 'Space', 3),
  ('interest', 'weather', 'Weather', 4),
  ('interest', 'ocean', 'Fish & ocean', 5),
  ('interest', 'numbers', 'Numbers & counting', 6),
  ('interest', 'shapes_colors', 'Shapes & colours', 7),
  ('interest', 'letters', 'Letters & phonics', 8),
  ('interest', 'words', 'First words', 9),
  ('interest', 'body', 'Body parts', 10),
  ('interest', 'emotions', 'Feelings', 11),
  ('interest', 'kindness', 'Kindness & manners', 12),
  ('interest', 'science_experiments', 'Simple science', 13),
  ('interest', 'art', 'Drawing & crafts', 14),
  ('interest', 'music', 'Music & dance', 15),
  ('interest', 'yoga', 'Yoga & breathing', 16),
  ('interest', 'stories', 'Stories', 17),
  ('interest', 'pretend_play', 'Pretend play', 18),
  ('interest', 'how_things_work', 'How things work', 19),
  ('development_goal', 'emotional', 'Emotional', 1),
  ('development_goal', 'social', 'Social', 2),
  ('development_goal', 'cognitive', 'Cognitive', 3),
  ('development_goal', 'communication', 'Communication', 4),
  ('development_goal', 'creativity', 'Creativity', 5),
  ('development_goal', 'motor_skills', 'Motor skills', 6),
  ('development_goal', 'learning', 'Learning', 7),
  ('development_goal', 'problem_solving', 'Problem solving', 8),
  ('regulation_goal', 'calm', 'Calm', 1),
  ('regulation_goal', 'emotional_regulation', 'Emotional regulation', 2),
  ('regulation_goal', 'focus', 'Focus', 3),
  ('regulation_goal', 'movement', 'Movement', 4),
  ('regulation_goal', 'relaxation', 'Relaxation', 5),
  ('regulation_goal', 'social_regulation', 'Social regulation', 6),
  ('language', 'en', 'English', 1),
  ('language', 'hi', 'Hindi', 2),
  ('language', 'es', 'Spanish', 3);

CREATE TABLE child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL,
  nickname text NOT NULL,
  birth_year integer NOT NULL CHECK (birth_year BETWEEN 2015 AND 2100),
  birth_month integer NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  languages text[] NOT NULL DEFAULT '{en}',
  interests text[] NOT NULL DEFAULT '{}',
  content_types text[] NOT NULL DEFAULT '{}',
  preferred_categories text[] NOT NULL DEFAULT '{}',
  development_goals text[] NOT NULL DEFAULT '{}',
  regulation_goals text[] NOT NULL DEFAULT '{}',
  daily_minutes integer CHECK (daily_minutes IS NULL OR daily_minutes BETWEEN 5 AND 240),
  break_preference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- REQUESTED: the parent kept an item that still awaits admin approval.
CREATE TABLE library_items (
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('ADDED', 'DISMISSED', 'REMOVED', 'REQUESTED')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_profile_id, content_item_id)
);

CREATE TABLE content_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL,
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  content_item_id uuid REFERENCES content_items(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('ACCEPTED', 'INVALID_URL')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Gemini free tier: at most 8 hours of YouTube video per day (resets midnight Pacific).
CREATE TABLE ai_usage_daily (
  day date NOT NULL,
  model text NOT NULL,
  youtube_video_seconds integer NOT NULL DEFAULT 0,
  file_video_seconds integer NOT NULL DEFAULT 0,
  requests integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  est_cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (day, model)
);

-- Job queue: priority (parent requests first) and one pending job per dedupe key.
ALTER TABLE outbox_events
  ADD COLUMN priority integer NOT NULL DEFAULT 0,
  ADD COLUMN dedupe_key text,
  ADD COLUMN locked_at timestamptz;
DROP INDEX IF EXISTS outbox_events_pending_idx;
CREATE INDEX outbox_events_claim_idx ON outbox_events(status, priority DESC, available_at);
CREATE UNIQUE INDEX outbox_events_dedupe_idx ON outbox_events(dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('PENDING', 'PROCESSING');

CREATE INDEX content_items_state_idx ON content_items(current_status, analysis_status);
CREATE INDEX content_items_score_idx ON content_items(kidq_score DESC NULLS LAST);
CREATE INDEX content_items_age_idx ON content_items(age_min, age_max);
CREATE INDEX assessments_cache_idx ON assessments(content_item_id, cache_key) WHERE cache_key IS NOT NULL;
CREATE INDEX publication_decisions_item_idx ON publication_decisions(content_item_id, decided_at DESC);
CREATE INDEX kidq_scores_item_idx ON kidq_scores(content_item_id, created_at DESC);
CREATE INDEX editorial_revisions_item_idx ON editorial_revisions(content_item_id, created_at DESC);
CREATE INDEX expert_reviews_item_idx ON expert_reviews(content_item_id);
CREATE INDEX child_profiles_parent_idx ON child_profiles(parent_user_id);
CREATE INDEX library_items_content_idx ON library_items(content_item_id);
CREATE INDEX content_submissions_parent_idx ON content_submissions(parent_user_id, created_at DESC);

-- One row per content item with the README's canonical fields; readable in the Supabase SQL editor.
CREATE VIEW content_records_v WITH (security_invoker = true) AS
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
  tr.retrieval_status AS transcript_status, tr.transcript_text, tr.origin AS transcript_origin
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
