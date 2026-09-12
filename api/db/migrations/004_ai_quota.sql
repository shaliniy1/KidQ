-- Free-tier guard, part 2: when Gemini refuses requests because today's quota is used up, the
-- worker records it here and stops calling (and uploading media to) Gemini until the daily reset
-- at midnight Pacific, instead of retrying jobs until they fail.
ALTER TABLE ai_usage_daily ADD COLUMN IF NOT EXISTS quota_exhausted_at timestamptz;
