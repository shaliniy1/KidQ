// The API contract shared by the admin app and the parent/child app. These zod schemas both
// validate requests and generate /openapi.json, so UIs can generate typed clients from it.
import { z } from "zod";
import { SOURCE_SYSTEM_IDS } from "../connectors";
import { RUBRIC } from "../domain/rubric";
import { COMPONENTS } from "../domain/scoring";
import { TAXONOMY_KINDS } from "../repositories/taxonomy";
import { registry } from "./route";

const nullableString = z.string().nullable();
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const sumsToOne = (record: Record<string, number>) => Math.abs(sum(Object.values(record)) - 1) < 0.001;

export const CONTENT_TYPES = ["VIDEO", "ACTIVITY", "STORYBOOK", "INTERACTIVE_CONTENT"] as const;
export const STUDIO_STATES = [
  "PENDING_ANALYSIS",
  "ANALYSING",
  "READY_TO_APPROVE",
  "NEEDS_ATTENTION",
  "ANALYSIS_INCOMPLETE",
  "FAILED",
  "APPROVED",
  "REJECTED",
] as const;
export const DECISIONS = ["APPROVED", "REJECTED", "MANUAL_REVIEW_REQUIRED"] as const;
const RUBRIC_KEYS = RUBRIC.map((criterion) => criterion.key) as [string, ...string[]];

export const idParams = z.object({ id: z.uuid() });
export const childParams = z.object({ id: z.uuid() });
export const childItemParams = z.object({ id: z.uuid(), contentItemId: z.uuid() });

// ── Content card (the one shape every screen renders) ─────────────────────────
export const contentScoreSchema = registry.register(
  "ContentScore",
  z.object({
    score: z.number().nullable(),
    confidence: z.number(),
    version: nullableString,
    breakdown: z.array(
      z.object({
        key: z.enum(COMPONENTS),
        label: z.string(),
        score: z.number().nullable(),
        weight: z.number(),
        source: z.enum(["AI", "ADMIN", "RULE"]).nullable(),
        evidence: nullableString,
        timestamps: z.array(z.string()),
      }),
    ),
    reason: z.string(),
    missing: z.array(z.string()),
    safety_flags: z.array(z.object({ key: z.string(), evidence: z.string(), timestamps: z.array(z.string()) })),
    evaluated_by: z.string(),
    reviewed_at: nullableString,
  }),
);

export const playerSchema = registry.register(
  "Player",
  z
    .union([
      z.object({
        provider: z.literal("youtube"),
        video_id: z.string(),
        embed_url: z.string(),
        params: z.record(z.string(), z.number()),
      }),
      z.object({ provider: z.literal("html5"), media_url: z.string(), mime_type: nullableString }),
    ])
    .nullable(),
);

export const contentCardSchema = registry.register(
  "ContentCard",
  z.object({
    id: z.uuid(),
    title: z.string(),
    kidq_summary: nullableString,
    content_type: z.enum(CONTENT_TYPES),
    source: z.enum(SOURCE_SYSTEM_IDS as [string, ...string[]]),
    creator: nullableString,
    duration_seconds: z.number().nullable(),
    language: nullableString,
    thumbnails: z.record(z.string(), z.string()),
    thumbnail_url: nullableString,
    age: z.object({ min: z.number().nullable(), max: z.number().nullable(), groups: z.array(z.string()) }),
    category: nullableString,
    interests: z.array(z.string()),
    development_goals: z.array(z.string()),
    regulation_goals: z.array(z.string()),
    // A union, not .nullable(): OpenAPI 3.1 then emits anyOf [ContentScore, null], which client
    // generators read as `ContentScore | null` (nullable refs become an impossible intersection).
    content_score: z.union([contentScoreSchema, z.null()]),
    expert_review: z.object({ recommend: z.number(), total: z.number(), verified: z.number() }).nullable(),
    player: playerSchema,
    attribution: z.object({
      text: nullableString,
      required: z.boolean().nullable(),
      license_name: nullableString,
      license_url: nullableString,
    }),
  }),
);

export const adminContentSchema = registry.register(
  "AdminContent",
  contentCardSchema.extend({
    studio_state: z.enum(STUDIO_STATES),
    analysis_status: z.string(),
    current_status: z.enum(DECISIONS),
    publish_blockers: z.array(z.string()),
    has_critical_flag: z.boolean(),
    parent_requests: z.number(),
    created_at: z.string(),
    published_at: nullableString,
  }),
);

export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number(), limit: z.number(), offset: z.number() });

// ── Admin requests ───────────────────────────────────────────────────────────
export const listContentQuery = z.object({
  state: z.enum(STUDIO_STATES).optional(),
  age_group: z.enum(["0_2", "2_4", "4_6"]).optional(),
  category: z.string().max(60).optional(),
  source: z.enum(SOURCE_SYSTEM_IDS as [string, ...string[]]).optional(),
  flagged: z.enum(["true", "false"]).optional(),
  min_score: z.coerce.number().min(0).max(100).optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(["newest", "score", "title"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListContentQuery = z.infer<typeof listContentQuery>;

export const pagingQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const hintsSchema = z.object({
  interests: z.array(z.string()).optional(),
  category: z.string().optional(),
  developmentGoals: z.array(z.string()).optional(),
  regulationGoals: z.array(z.string()).optional(),
  ageMin: z.number().min(0).max(6).optional(),
  ageMax: z.number().min(0).max(6).optional(),
});

export const ingestionRunBody = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("urls"),
    source: z.literal("youtube").default("youtube"),
    urls: z.array(z.string().min(5).max(500)).min(1).max(300),
    hints: hintsSchema.optional(),
  }),
  z.object({
    mode: z.literal("search"),
    source: z.enum(SOURCE_SYSTEM_IDS as [string, ...string[]]),
    queries: z
      .array(
        z.object({
          query: z.string().min(2).max(200),
          maxResults: z.number().int().min(1).max(50).default(10),
          language: z.string().max(10).optional(),
          regionCode: z.string().length(2).optional(),
          hints: hintsSchema.optional(),
        }),
      )
      .min(1)
      .max(30),
  }),
]);

export const ingestionRunSchema = z.object({
  ingestion_run_id: z.uuid(),
  source_system_id: z.string(),
  connector_version: nullableString,
  query: z.unknown(),
  started_at: nullableString,
  finished_at: nullableString,
  status: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"]),
  records_seen: z.number(),
  records_created: z.number(),
  records_updated: z.number(),
  records_unchanged: z.number(),
  records_rejected_before_ai: z.number(),
  errors: z.array(z.object({ external_id: nullableString, code: z.string(), message: z.string(), retryable: z.boolean() })),
});

const slider = z.object({ value: z.number().min(0).max(100), evidence: z.string().min(3).max(500) });
export const humanAssessmentBody = z.object({
  scores: z
    .object({ CONTENT_LANGUAGE: slider.optional(), PACING: slider.optional(), VISUAL_COMFORT: slider.optional(), AUDIO_COMFORT: slider.optional() })
    .default({}),
  criteria: z
    .array(z.object({ key: z.enum(RUBRIC_KEYS), result: z.enum(["PASS", "FAIL", "UNKNOWN"]), evidence: z.string().min(3).max(500) }))
    .max(RUBRIC.length)
    .default([]),
  note: z.string().max(1000).optional(),
});

export const classificationBody = z
  .object({
    age_min: z.number().min(0).max(6).nullable().optional(),
    age_max: z.number().min(0).max(6).nullable().optional(),
    category: z.string().max(60).nullable().optional(),
    subcategory: z.string().max(100).nullable().optional(),
    interests: z.array(z.string().max(60)).max(20).optional(),
    development_goals: z.array(z.string().max(60)).max(10).optional(),
    regulation_goals: z.array(z.string().max(60)).max(10).optional(),
    language: z.string().max(10).nullable().optional(),
    content_type: z.enum(CONTENT_TYPES).optional(),
  })
  .refine((body) => body.age_min == null || body.age_max == null || body.age_min <= body.age_max, "age_min must not exceed age_max");
export type ClassificationBody = z.infer<typeof classificationBody>;

export const bulkClassificationBody = z.object({
  content_item_ids: z.array(z.uuid()).min(1).max(300),
  changes: classificationBody,
});

export const editorialBody = z
  .object({
    title: z.string().min(1).max(200).optional(),
    kidq_summary: z.string().max(400).nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
    learning_objective: z.string().max(300).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Nothing to change");
export type EditorialBody = z.infer<typeof editorialBody>;

export const decisionBody = z.object({
  decision: z.enum(DECISIONS),
  reason: z.string().min(3).max(1000),
  override_critical_flag: z.boolean().default(false),
});

export const bulkDecisionBody = z.object({
  content_item_ids: z.array(z.uuid()).min(1).max(300),
  decision: z.enum(DECISIONS),
  reason: z.string().min(3).max(1000),
});

export const bulkResultSchema = z.object({
  results: z.array(z.object({ content_item_id: z.uuid(), ok: z.boolean(), blockers: z.array(z.string()), message: nullableString })),
});

export const expertReviewBody = z.object({
  reviewer_name: z.string().min(1).max(120),
  reviewer_type: z.string().min(1).max(80),
  credentials: z.string().max(200).nullable().optional(),
  recommendation: z.enum(["RECOMMEND", "NOT_RECOMMEND"]),
  recommended_age_min: z.number().min(0).max(6).nullable().optional(),
  recommended_age_max: z.number().min(0).max(6).nullable().optional(),
  comments: z.string().max(2000).nullable().optional(),
  source_url: z.url(),
  verified: z.boolean().default(false),
});

export const scoringConfigBody = z.object({
  weights: z
    .object({ CONTENT_LANGUAGE: z.number().min(0).max(1), PACING: z.number().min(0).max(1), VISUAL_COMFORT: z.number().min(0).max(1), AUDIO_COMFORT: z.number().min(0).max(1) })
    .refine(sumsToOne, "Weights must add up to 1"),
  source_reliability: z.object({ HUMAN: z.number().min(0).max(1), MODEL: z.number().min(0).max(1), RULE: z.number().min(0).max(1) }),
  min_ai_confidence: z.number().min(0).max(1),
});

export const rankingConfigBody = z.object({
  weights: z
    .object({ relevance: z.number().min(0).max(1), score: z.number().min(0).max(1), expert: z.number().min(0).max(1), preference: z.number().min(0).max(1) })
    .refine(sumsToOne, "Weights must add up to 1"),
  relevance_weights: z
    .object({ interests: z.number().min(0).max(1), development_goals: z.number().min(0).max(1), regulation_goals: z.number().min(0).max(1), category: z.number().min(0).max(1) })
    .refine(sumsToOne, "Relevance weights must add up to 1"),
  max_per_creator_in_top: z.number().int().min(1).max(20),
  top_window: z.number().int().min(5).max(100),
  dismiss_cooldown_days: z.number().int().min(0).max(365),
  expert_neutral: z.number().min(0).max(1),
});

export const taxonomyBody = z.object({
  kind: z.enum(TAXONOMY_KINDS),
  key: z.string().regex(/^[a-z0-9_]{2,40}$/, "Use lowercase letters, digits and underscores"),
  label: z.string().min(1).max(60),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const taxonomySchema = z.record(
  z.string(),
  z.array(z.object({ kind: z.string(), key: z.string(), label: z.string(), sortOrder: z.number(), active: z.boolean(), meta: z.record(z.string(), z.unknown()) })),
);

export const playbackErrorBody = z.object({ code: z.number().int() });

// ── Parent requests ──────────────────────────────────────────────────────────
export const childBody = z.object({
  nickname: z.string().min(1).max(40),
  birth_year: z.number().int().min(2015).max(2100),
  birth_month: z.number().int().min(1).max(12),
  languages: z.array(z.string().max(10)).min(1).max(5).default(["en"]),
  interests: z.array(z.string().max(60)).max(20).default([]),
  content_types: z.array(z.enum(CONTENT_TYPES)).max(4).default([]),
  preferred_categories: z.array(z.string().max(60)).max(15).default([]),
  development_goals: z.array(z.string().max(60)).max(10).default([]),
  regulation_goals: z.array(z.string().max(60)).max(10).default([]),
  daily_minutes: z.number().int().min(5).max(240).nullable().default(null),
  break_preference: z.string().max(60).nullable().default(null),
});
export type ChildBody = z.infer<typeof childBody>;

export const childPatchBody = childBody.partial();

export const childSchema = registry.register(
  "Child",
  childBody.extend({ id: z.uuid(), age_years: z.number(), created_at: z.string(), updated_at: z.string() }),
);

export const recommendationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const recommendationSchema = registry.register(
  "Recommendation",
  z.object({ rank: z.number(), final_score: z.number(), relevance: z.number(), cold_start: z.boolean(), why: z.array(z.string()), card: contentCardSchema }),
);

export const libraryBody = z.object({ content_item_id: z.uuid(), state: z.enum(["ADDED", "DISMISSED"]).default("ADDED") });

export const libraryItemSchema = z.object({
  state: z.enum(["ADDED", "REQUESTED", "DISMISSED"]),
  awaiting_review: z.boolean(),
  updated_at: z.string(),
  card: contentCardSchema,
});

export const submissionBody = z.object({ url: z.string().min(5).max(500) });

export const submissionSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  status: z.enum(["ACCEPTED", "INVALID_URL"]),
  error: nullableString,
  created_at: z.string(),
  assessment: z.enum(["PENDING", "SCORED", "APPROVED", "REJECTED", "NEEDS_REVIEW"]).nullable(),
  card: z.union([contentCardSchema, z.null()]),
});

export const previewBody = z.object({
  age_years: z.number().min(0).max(6),
  languages: z.array(z.string().max(10)).min(1).max(5).default(["en"]),
  interests: z.array(z.string()).max(20).default([]),
  content_types: z.array(z.enum(CONTENT_TYPES)).max(4).default([]),
  preferred_categories: z.array(z.string()).max(15).default([]),
  development_goals: z.array(z.string()).max(10).default([]),
  regulation_goals: z.array(z.string()).max(10).default([]),
  daily_minutes: z.number().int().min(5).max(240).nullable().default(null),
  limit: z.number().int().min(1).max(50).default(20),
});
