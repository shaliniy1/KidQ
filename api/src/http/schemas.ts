// The API contract shared by the admin app and the parent/child app. These zod schemas both
// validate requests and generate /openapi.json, so UIs can generate typed clients from it.
import { z } from "zod";
import { SOURCE_SYSTEM_IDS } from "../connectors";
import { AGE_BAND_KEYS } from "../domain/age";
import { BREAK_TYPES, CONTENT_MIXES, MAX_CHILDREN } from "../domain/onboarding";
import { RUBRIC } from "../domain/rubric";
import { COMPONENTS } from "../domain/scoring";
import { TAXONOMY_KINDS } from "../repositories/taxonomy";
import { registry } from "./route";

const nullableString = z.string().nullable();
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const sumsToOne = (record: Record<string, number>) => Math.abs(sum(Object.values(record)) - 1) < 0.001;

export const CONTENT_TYPES = ["VIDEO", "ACTIVITY", "STORYBOOK", "INTERACTIVE_CONTENT"] as const;
// What the admin sees (docs/recommendation/README.md "Admin gate"). analysis_status and current_status stay internal.
export const STUDIO_STATES = ["PENDING_ANALYSIS", "READY_TO_APPROVE", "NEEDS_ATTENTION", "APPROVED", "REJECTED"] as const;
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
        capped_by: nullableString.describe("The failed check that capped this part, e.g. rapid_visual_cuts; never set on an admin's score"),
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
      z.object({ provider: z.literal("story"), page_count: z.number() }),
    ])
    .nullable(),
);

// A picture book for the KidQ reader: story text per page; illustrations load from the source.
export const storySchema = registry.register(
  "Story",
  z.object({
    title: z.string(),
    pages: z.array(z.object({ page: z.number(), text: z.string(), image_url: nullableString, image_small_url: nullableString })),
    credits: nullableString.describe("The source's full attribution: story, illustrations, translation, publisher and license"),
    attribution: z.object({ text: nullableString, license_name: nullableString, license_url: nullableString }),
  }),
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
    category: nullableString.describe("The primary category"),
    categories: z.array(z.string()).describe("Every category the item fits (at most three), primary first"),
    interests: z.array(z.string()),
    development_goals: z.array(z.string()),
    regulation_goals: z.array(z.string()),
    // A union, not .nullable(): OpenAPI 3.1 then emits anyOf [ContentScore, null], which client
    // generators read as `ContentScore | null` (nullable refs become an impossible intersection).
    content_score: z.union([contentScoreSchema, z.null()]),
    learning: z
      .object({ value: z.number().nullable(), areas: z.array(z.string()) })
      .describe("What the child can learn or do, kept separate from the KidQ score: 25 points per area (Thinking, Language, Feelings & friends, Doing)"),
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
  age_group: z.enum(AGE_BAND_KEYS).optional(),
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
    category: z.string().max(60).nullable().optional().describe("The primary category; it leads `categories`"),
    categories: z.array(z.string().max(60)).max(3).optional().describe("Every category the item fits, primary first; overrides `category`"),
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
  override_critical_flag: z
    .boolean()
    .default(false)
    .describe("Publish over KidQ's checks (a safety flag, an exclusion, a score under 70 or low confidence) with a written reason of 15+ characters"),
});

export const bulkDecisionBody = z.object({
  content_item_ids: z.array(z.uuid()).min(1).max(300),
  decision: z.enum(DECISIONS),
  reason: z.string().min(3).max(1000),
});

export const bulkResultSchema = z.object({
  results: z.array(z.object({ content_item_id: z.uuid(), ok: z.boolean(), blockers: z.array(z.string()), message: nullableString })),
});

export const bulkReanalyzeBody = z.object({
  scope: z.enum(["UNSCORED"]).describe("UNSCORED: every item the AI hasn't reviewed yet, except rejected ones"),
});

export const dashboardSchema = z.object({
  total: z.number(),
  by_state: z.record(z.string(), z.number()),
  by_source: z.record(z.string(), z.number()),
  flagged: z.number(),
  queue: z.array(z.object({ event_type: z.string(), status: z.string(), n: z.number() })),
  ai: z.object({
    enabled: z.boolean(),
    model: z.string().describe("The scoring model; the fallbacks in `models` take over when its free daily quota runs out"),
    models: z
      .array(z.object({ model: z.string(), requests: z.number(), paused: z.boolean() }))
      .describe("The scoring model and its fallbacks, in the order they're tried, with today's use"),
    paused_until: nullableString.describe("Set while every model has used its daily quota; AI scoring resumes then"),
    scored: z.number().describe("Items the AI has reviewed and scored with the current prompt"),
    queued: z.number().describe("Items waiting for, or going through, analysis"),
    unscored: z.number().describe("Items the AI hasn't reviewed with the current prompt yet, rejected ones excluded"),
    could_not_review: z.number().describe("Items the AI couldn't review: media rights, length, private video or invalid output"),
    today: z.object({ requests: z.number(), youtube_video_seconds: z.number(), file_video_seconds: z.number(), youtube_daily_cap_seconds: z.number() }),
  }),
});

export const contentPoolSchema = z.object({
  published: z.number(),
  eligible: z.number().describe("Published items that pass every check and can be recommended"),
  thin_below: z.number(),
  bands: z.array(
    z.object({
      age_band: z.string(),
      total: z.number(),
      categories: z.array(z.object({ category: z.string(), count: z.number(), thin: z.boolean() })),
    }),
  ),
  not_reaching_parents: z
    .array(z.object({ id: z.uuid(), title: z.string(), problems: z.array(z.string()) }))
    .describe("Published but never recommended: NOT_PLAYABLE, SAFETY_FLAG, NOT_SCORED, NO_AGE, NO_CATEGORY or NO_GOAL"),
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
    .object({
      relevance: z.number().min(0).max(1),
      score: z.number().min(0).max(1),
      learning: z.number().min(0).max(1).default(0),
      preference: z.number().min(0).max(1).describe("Fit: the child's age near the middle of the item's range, and the item inside one session"),
    })
    .refine(sumsToOne, "Weights must add up to 1"),
  relevance_weights: z
    .object({ interests: z.number().min(0).max(1), development_goals: z.number().min(0).max(1), regulation_goals: z.number().min(0).max(1), category: z.number().min(0).max(1) })
    .refine(sumsToOne, "Relevance weights must add up to 1"),
  max_per_creator_in_top: z.number().int().min(1).max(20),
  top_window: z.number().int().min(5).max(100),
  dismiss_cooldown_days: z.number().int().min(0).max(365),
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

// ── Parent requests (onboarding: docs/recommendation/parent-onboarding.md) ──────
const ageBand = z.enum(AGE_BAND_KEYS).describe("Age band: the same five bands admins tag content with");
const sessionMinutes = z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60), z.literal(90)]);
const nickname = z.string().trim().min(1).max(40).describe("A nickname only, never the child's legal name");
const languageKey = z.string().min(2).max(10);

// The optional "Customize" blocks. Anything left out keeps its age-based default.
const childPreferences = z.object({
  languages: z.array(languageKey).min(1).max(3).describe("Content languages the parent chose (keys from GET /taxonomy); defaults to the parent's language"),
  interests: z.array(z.string().max(60)).max(19).describe("Block A. Empty broadens the feed; it never narrows it."),
  content_mix: z.enum(CONTENT_MIXES).describe("Block B. SURPRISE: an age-appropriate mix. CHOSEN: only preferred_categories."),
  preferred_categories: z.array(z.string().max(60)).max(12).describe("Block B categories; sending some without content_mix means CHOSEN"),
  development_goals: z.array(z.string().max(60)).max(8).describe("Block C: never asked. Omit, or send [], for the age-band defaults."),
  regulation_goals: z.array(z.string().max(60)).max(6).describe("Block D. Empty or all six means no restriction."),
  session_minutes: sessionMinutes.describe("Block E: session length; the breaks follow from it"),
  break_type: z.enum(BREAK_TYPES).describe("Block E: MOVEMENT, QUIET or ALTERNATE"),
});

export const childBody = childPreferences.partial().extend({ nickname, age_band: ageBand });
export type ChildBody = z.infer<typeof childBody>;

export const childPatchBody = childBody.partial();
export type ChildPatchBody = z.infer<typeof childPatchBody>;

export const childSchema = registry.register(
  "Child",
  childPreferences.extend({
    id: z.uuid(),
    nickname: z.string(),
    age_band: ageBand.describe("The band today: the one the parent picked, moved on as the child grows"),
    age_years: z.number().describe("Estimated from the band and the time since it was set"),
    development_goals_source: z.enum(["AGE_DEFAULT", "PARENT"]),
    break_plan: z
      .object({ total_breaks: z.number(), mid_session_breaks: z.number(), wind_down: z.boolean() })
      .describe("One break per 15 minutes; the last is always the wind-down"),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

export const onboardingBody = z.object({
  parent_name: z.string().trim().min(1).max(80),
  language: languageKey.default("en").describe("The parent's pick, pre-selected from the device language when KidQ has it; children start with it"),
  children: z.array(z.object({ nickname, age_band: ageBand })).min(1).max(MAX_CHILDREN),
});
export type OnboardingBody = z.infer<typeof onboardingBody>;

export const meSchema = z.object({
  parent: z.object({ name: z.string(), language: z.string(), created_at: z.string(), updated_at: z.string() }),
  children: z.array(childSchema),
});

export const mePatchBody = z
  .object({ name: z.string().trim().min(1).max(80).optional(), language: languageKey.optional() })
  .refine((body) => Object.keys(body).length > 0, "Nothing to change");
export type MePatchBody = z.infer<typeof mePatchBody>;

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

// ── Sessions (docs/recommendation/parent-experience.md §2–5) ──────────────────
export const sessionParams = z.object({ id: z.uuid() });
export const sessionItemParams = z.object({ id: z.uuid(), itemId: z.uuid() });
export const sessionStartBody = z.object({
  minutes: z.number().int().min(15).max(180).describe("15, 30, 45, 60 or 90; any other length snaps to 30-minute blocks"),
});
export const sessionItemBody = z.object({
  outcome: z.enum(["COMPLETED", "SKIPPED", "EXITED"]),
  watched_seconds: z.number().int().min(0).max(86_400).optional(),
});
export const sessionEndBody = z.object({ outcome: z.enum(["COMPLETED", "EXITED"]).describe("COMPLETED: the wind-down finished. EXITED: the child left early; there's no resume") });
export const sessionSchema = registry.register(
  "Session",
  z.object({
    id: z.uuid(),
    child_id: z.uuid(),
    minutes: z.number(),
    started_at: z.string(),
    ended_at: nullableString,
    outcome: z.enum(["COMPLETED", "EXITED"]).nullable(),
    short_by_minutes: z.number().describe("How far the child's library fell short of the chosen time; 0 when it filled it"),
    slots: z.array(
      z.object({
        slot: z.number(),
        break_after: z.enum(["MOVEMENT", "QUIET", "WIND_DOWN"]).describe("The break after this slot; the last is always WIND_DOWN"),
        items: z.array(
          z.object({
            id: z.uuid(),
            position: z.number(),
            outcome: z.enum(["COMPLETED", "SKIPPED", "EXITED"]).nullable(),
            watched_seconds: z.number().nullable(),
            card: contentCardSchema,
          }),
        ),
      }),
    ),
  }),
);

// Admin preview: the same fields as a child profile, applied to an imaginary child.
export const previewBody = childPreferences.partial().extend({
  age_band: ageBand,
  limit: z.number().int().min(1).max(50).default(20),
});
export type PreviewBody = z.infer<typeof previewBody>;
