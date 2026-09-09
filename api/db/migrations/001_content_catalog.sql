CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE source_systems (
  id text PRIMARY KEY,
  name text NOT NULL,
  base_url text NOT NULL,
  connector_version text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system_id text NOT NULL REFERENCES source_systems(id),
  query jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')),
  records_seen integer NOT NULL DEFAULT 0,
  records_created integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE ingestion_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  external_id text,
  error_code text NOT NULL,
  redacted_message text NOT NULL,
  retryable boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('VIDEO', 'ACTIVITY', 'STORYBOOK', 'INTERACTIVE_CONTENT')),
  title text NOT NULL,
  description text,
  language text,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  thumbnail_url text,
  age_min numeric(3,1) CHECK (age_min IS NULL OR age_min BETWEEN 0 AND 6),
  age_max numeric(3,1) CHECK (age_max IS NULL OR age_max BETWEEN 0 AND 6),
  age_bands text[] NOT NULL DEFAULT '{}',
  category text,
  subcategory text,
  learning_objective text,
  skills text[] NOT NULL DEFAULT '{}',
  topics text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  current_status text NOT NULL DEFAULT 'MANUAL_REVIEW_REQUIRED'
    CHECK (current_status IN ('APPROVED', 'REJECTED', 'MANUAL_REVIEW_REQUIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max)
);

CREATE TABLE source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  source_system_id text NOT NULL REFERENCES source_systems(id),
  ingestion_run_id uuid REFERENCES ingestion_runs(id),
  external_id text NOT NULL,
  source_url text NOT NULL,
  embed_url text,
  creator text,
  caption_available boolean NOT NULL DEFAULT false,
  made_for_kids boolean,
  embeddable boolean,
  raw_metadata jsonb NOT NULL DEFAULT '{}',
  metadata_hash text NOT NULL,
  fetched_at timestamptz NOT NULL,
  last_verified_at timestamptz,
  UNIQUE (source_system_id, external_id)
);

CREATE TABLE source_record_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  ingestion_run_id uuid REFERENCES ingestion_runs(id),
  raw_metadata jsonb NOT NULL,
  metadata_hash text NOT NULL,
  fetched_at timestamptz NOT NULL,
  UNIQUE (source_record_id, metadata_hash)
);

CREATE TABLE rights_assertions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  license_name text,
  license_url text,
  attribution_text text,
  allows_embedding boolean,
  allows_metadata_storage boolean,
  allows_thumbnail_storage boolean,
  allows_transcript_storage boolean,
  allows_media_storage boolean,
  allows_adaptation boolean,
  allows_commercial_use boolean,
  attribution_required boolean,
  evidence_url text,
  evidence_text text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  language text,
  origin text NOT NULL CHECK (origin IN ('SOURCE_CAPTION', 'SOURCE_TRANSCRIPT', 'AUTHORIZED_TRANSCRIPTION')),
  retrieval_status text NOT NULL DEFAULT 'NOT_REQUESTED'
    CHECK (retrieval_status IN ('NOT_REQUESTED', 'QUEUED', 'FETCHING', 'AVAILABLE', 'UNAVAILABLE', 'NOT_AUTHORIZED', 'STORAGE_NOT_PERMITTED', 'TRANSCRIPTION_REQUIRED', 'FAILED_RETRYABLE', 'FAILED_FINAL')),
  transcript_text text,
  transcript_hash text,
  source_url text,
  storage_permitted boolean NOT NULL DEFAULT false,
  confidence numeric(4,3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  retrieval_error_code text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempted_at timestamptz,
  next_retry_at timestamptz,
  CHECK (storage_permitted OR transcript_text IS NULL),
  CHECK (retrieval_status <> 'AVAILABLE' OR transcript_hash IS NOT NULL),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  assessor_type text NOT NULL CHECK (assessor_type IN ('RULE', 'MODEL', 'HUMAN')),
  assessor_name text NOT NULL,
  model_name text,
  model_snapshot text,
  prompt_version text,
  rubric_version text NOT NULL,
  input_hash text,
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  cached_input_tokens integer CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  estimated_cost_usd numeric(14,8) CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0),
  result text NOT NULL CHECK (result IN ('APPROVED', 'REJECTED', 'MANUAL_REVIEW_REQUIRED')),
  summary text NOT NULL,
  audiovisual_inspected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessment_criteria (
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  criterion_key text NOT NULL,
  criterion_group text NOT NULL CHECK (criterion_group IN ('FILTER_IN', 'FILTER_OUT')),
  result text NOT NULL CHECK (result IN ('PASS', 'FAIL', 'UNKNOWN')),
  evidence text NOT NULL,
  PRIMARY KEY (assessment_id, criterion_key)
);

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid REFERENCES content_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  instruction text NOT NULL,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  activity_type text NOT NULL,
  age_bands text[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  materials text[] NOT NULL DEFAULT '{}',
  supervision_required boolean,
  accessibility_notes text,
  safety_notes text,
  kidq_owned boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE publication_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED', 'MANUAL_REVIEW_REQUIRED')),
  reason text NOT NULL,
  decided_by text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX source_records_content_item_idx ON source_records(content_item_id);
CREATE INDEX source_record_snapshots_record_idx ON source_record_snapshots(source_record_id, fetched_at DESC);
CREATE INDEX content_items_status_idx ON content_items(current_status);
CREATE INDEX content_items_topics_idx ON content_items USING gin(topics);
CREATE INDEX assessments_content_item_idx ON assessments(content_item_id, created_at DESC);
CREATE INDEX ingestion_errors_run_idx ON ingestion_errors(ingestion_run_id, occurred_at);
CREATE INDEX transcripts_retry_idx ON transcripts(retrieval_status, next_retry_at);
CREATE INDEX outbox_events_pending_idx ON outbox_events(status, available_at);
