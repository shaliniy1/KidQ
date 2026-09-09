export type ContentType = "VIDEO" | "ACTIVITY" | "STORYBOOK" | "INTERACTIVE_CONTENT";
export type Assessment = "PASS" | "FAIL" | "UNKNOWN";
export type ContentStatus = "APPROVED" | "REJECTED" | "MANUAL_REVIEW_REQUIRED";

export interface CriterionAssessment {
  status: Assessment;
  evidence: string;
}

export interface KidqContentRecord {
  content_id: string;
  content_type: ContentType;
  title: string;
  source: "youtube" | "open_web";
  source_url: string;
  embed_url: string | null;
  source_video_id: string | null;
  channel_or_creator: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  language: string | null;
  caption_available: boolean;
  transcript: string | null;
  transcript_source: string | null;
  description: string | null;
  made_for_kids: boolean | null;
  embeddable: boolean | null;
  license_if_known: string | null;
  category: string | null;
  subcategory: string | null;
  age_min: number | null;
  age_max: number | null;
  age_band: string[];
  learning_objective: string | null;
  skills_developed: string[];
  topics: string[];
  keywords: string[];
  activity_supported: boolean;
  activity_title: string | null;
  activity_instruction: string | null;
  activity_duration_seconds: number | null;
  activity_type: string | null;
  filter_out: Record<string, CriterionAssessment>;
  filter_in: Record<string, CriterionAssessment>;
  filter_out_fail_count: number;
  filter_in_pass_count: number;
  content_status: ContentStatus;
  rejection_reason: string | null;
  manual_review_reason: string | null;
  kidq_summary: string;
  fetched_at: string;
  provenance: {
    method: "youtube_data_api" | "open_web_fetch";
    inspected_fields: string[];
    audiovisual_inspected: boolean;
  };
}

export interface DiscoveryRequest {
  query: string;
  source?: "youtube" | "open_web";
  max_results?: number;
  region_code?: string;
  language?: string;
  open_urls?: string[];
}
