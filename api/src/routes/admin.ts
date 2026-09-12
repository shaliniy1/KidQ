// Admin Content Studio API. Route names follow docs/content-curation/README.md
// ("Desired ingestion API"); everything here requires the admin role.
import { Router } from "express";
import { z } from "zod";
import { getPool, withTransaction } from "../db/pool";
import { actorName } from "../http/auth";
import { notFound } from "../http/errors";
import { defineRoute } from "../http/route";
import {
  adminContentSchema,
  bulkClassificationBody,
  bulkDecisionBody,
  bulkResultSchema,
  classificationBody,
  decisionBody,
  editorialBody,
  expertReviewBody,
  humanAssessmentBody,
  idParams,
  ingestionRunBody,
  ingestionRunSchema,
  listContentQuery,
  pageOf,
  pagingQuery,
  playbackErrorBody,
  previewBody,
  rankingConfigBody,
  recommendationSchema,
  scoringConfigBody,
  taxonomyBody,
} from "../http/schemas";
import { getActiveRankingConfig, getActiveScoringConfig, saveRankingConfig, saveScoringConfig } from "../repositories/config";
import { getAdminDetail, listAdminContent, listReviewQueue } from "../repositories/content";
import { upsertTaxonomyTerm } from "../repositories/taxonomy";
import * as admin from "../services/admin";
import { createIngestionRun, getIngestionRun } from "../services/ingestion";
import { previewRecommendations } from "../services/parents";

export const adminRouter = Router();
const ADMIN = ["admin"] as const;
const roles = [...ADMIN];

const adminDetailSchema = z.object({
  content: adminContentSchema,
  record: z.record(z.string(), z.unknown()).describe("README canonical content record (all required keys)"),
  assessments: z.array(z.record(z.string(), z.unknown())),
  decisions: z.array(z.record(z.string(), z.unknown())),
  revisions: z.array(z.record(z.string(), z.unknown())),
  expert_reviews: z.array(z.record(z.string(), z.unknown())),
  rights: z.record(z.string(), z.unknown()),
  transcript_status: z.string().nullable(),
  raw_metadata: z.unknown(),
});
const queued = z.object({ queued: z.boolean() });

async function detailOr404(id: string) {
  const detail = await getAdminDetail(getPool(), id);
  if (!detail) throw notFound("Content item");
  return detail;
}

// ── Ingestion ─────────────────────────────────────────────────────────────────
defineRoute(
  adminRouter,
  { method: "post", path: "/ingestion-runs", summary: "Start an ingestion run (URLs or discovery queries); returns 202 immediately", tag: "Ingestion", roles, body: ingestionRunBody, response: ingestionRunSchema, status: 202 },
  async ({ body, user }) => {
    const pool = getPool();
    const runId = await createIngestionRun(pool, {
      sourceSystemId: body.source as "youtube" | "nasa_images" | "wikimedia_commons",
      query: body.mode === "urls" ? { mode: "urls", urls: body.urls, hints: body.hints } : { mode: "search", queries: body.queries },
      requestedBy: actorName(user),
    });
    return getIngestionRun(pool, runId);
  },
);

defineRoute(
  adminRouter,
  { method: "get", path: "/ingestion-runs", summary: "Recent ingestion runs", tag: "Ingestion", roles, response: z.object({ items: z.array(z.record(z.string(), z.unknown())) }) },
  async () => {
    const { rows } = await getPool().query(
      `SELECT id AS ingestion_run_id, source_system_id, status, records_seen, records_created, records_updated, records_unchanged,
         records_rejected_before_ai, requested_by, started_at, finished_at FROM ingestion_runs ORDER BY started_at DESC LIMIT 30`,
    );
    return { items: rows };
  },
);

defineRoute(
  adminRouter,
  { method: "get", path: "/ingestion-runs/:id", summary: "Ingestion run status (README connector result contract)", tag: "Ingestion", roles, params: idParams, response: ingestionRunSchema },
  async ({ params }) => {
    const run = await getIngestionRun(getPool(), params.id);
    if (!run) throw notFound("Ingestion run");
    return run;
  },
);

// ── Content ───────────────────────────────────────────────────────────────────
defineRoute(
  adminRouter,
  { method: "get", path: "/content-items", summary: "All content with studio state, score and tags (filters + paging)", tag: "Content", roles, query: listContentQuery, response: pageOf(adminContentSchema) },
  async ({ query }) => listAdminContent(getPool(), query),
);

defineRoute(
  adminRouter,
  { method: "get", path: "/review-queue", summary: "Items waiting for an admin (parent requests first)", tag: "Content", roles, query: pagingQuery, response: pageOf(adminContentSchema) },
  async ({ query }) => listReviewQueue(getPool(), query.limit, query.offset),
);

defineRoute(
  adminRouter,
  { method: "get", path: "/content-items/:id", summary: "Full detail: card, canonical record, assessments, decisions, edits", tag: "Content", roles, params: idParams, response: adminDetailSchema },
  async ({ params }) => detailOr404(params.id),
);

defineRoute(
  adminRouter,
  { method: "patch", path: "/content-items/:id", summary: "Edit child-facing text (title, summary, description, learning objective)", tag: "Content", roles, params: idParams, body: editorialBody, response: adminDetailSchema },
  async ({ params, body, user }) => admin.editEditorial(user, params.id, body),
);

defineRoute(
  adminRouter,
  { method: "post", path: "/content-items/:id/assessments", summary: "Admin scores (0–100 sliders) and rubric results; overrides the AI", tag: "Scoring", roles, params: idParams, body: humanAssessmentBody, response: adminDetailSchema, status: 201 },
  async ({ params, body, user }) => admin.submitHumanAssessment(user, params.id, body),
);

defineRoute(
  adminRouter,
  { method: "patch", path: "/content-items/:id/classification", summary: "Set age, category, interests, goals, language, content type", tag: "Scoring", roles, params: idParams, body: classificationBody, response: adminDetailSchema },
  async ({ params, body, user }) => admin.updateClassification(user, params.id, body),
);

defineRoute(
  adminRouter,
  { method: "post", path: "/content-items/bulk-classification", summary: "Apply the same tags to many items", tag: "Scoring", roles, body: bulkClassificationBody, response: bulkResultSchema },
  async ({ body, user }) => admin.bulkClassify(user, body.content_item_ids, body.changes),
);

defineRoute(
  adminRouter,
  { method: "post", path: "/content-items/:id/publication-decisions", summary: "Approve, reject or unpublish (MANUAL_REVIEW_REQUIRED) one item", tag: "Publishing", roles, params: idParams, body: decisionBody, response: adminDetailSchema, status: 201 },
  async ({ params, body, user }) => admin.decide(user, params.id, body),
);

defineRoute(
  adminRouter,
  { method: "post", path: "/publication-decisions/bulk", summary: "Decide many items; blocked items are skipped with reasons", tag: "Publishing", roles, body: bulkDecisionBody, response: bulkResultSchema },
  async ({ body, user }) => admin.bulkDecide(user, body.content_item_ids, body.decision, body.reason),
);

defineRoute(
  adminRouter,
  { method: "post", path: "/content-items/:id/expert-reviews", summary: "Add an expert review (shown as 'per public sources' unless verified)", tag: "Scoring", roles, params: idParams, body: expertReviewBody, response: adminDetailSchema, status: 201 },
  async ({ params, body, user }) => admin.addExpertReview(user, params.id, body),
);

defineRoute(
  adminRouter,
  { method: "post", path: "/content-items/:id/reanalyze", summary: "Queue the rule checks and AI scoring again (ignores the cache)", tag: "Scoring", roles, params: idParams, response: queued, status: 202 },
  async ({ params }) => admin.reanalyze(params.id),
);

defineRoute(
  adminRouter,
  { method: "post", path: "/content-items/:id/playback-errors", summary: "Player reports a YouTube error; a verified check may hide the item", tag: "Content", roles: ["admin", "parent"], params: idParams, body: playbackErrorBody, response: queued, status: 202 },
  async ({ params, body }) => admin.reportPlaybackError(params.id, body.code),
);

defineRoute(
  adminRouter,
  { method: "get", path: "/dashboard", summary: "Counts by state and source, flags, queue and AI usage today", tag: "Content", roles, response: z.record(z.string(), z.unknown()) },
  async () => admin.dashboard(),
);

defineRoute(
  adminRouter,
  { method: "post", path: "/recommendations/preview", summary: "What a child with this profile would be recommended right now", tag: "Recommendations", roles, body: previewBody, response: z.object({ items: z.array(recommendationSchema), limit: z.number(), offset: z.number(), ranking_version: z.string() }) },
  async ({ body }) => previewRecommendations(body),
);

// ── Configuration ─────────────────────────────────────────────────────────────
const scoringConfigSchema = z.object({ version: z.string(), weights: z.record(z.string(), z.number()), sourceReliability: z.record(z.string(), z.number()), minAiConfidence: z.number() });
const rankingConfigSchema = z.object({ version: z.string(), weights: z.record(z.string(), z.number()), params: z.record(z.string(), z.unknown()) });

defineRoute(
  adminRouter,
  { method: "get", path: "/config/scoring", summary: "Active KidQ score weights (KIDQ_SCORE_Vn)", tag: "Configuration", roles, response: scoringConfigSchema },
  async () => getActiveScoringConfig(getPool()),
);

defineRoute(
  adminRouter,
  { method: "put", path: "/config/scoring", summary: "Save new score weights as a new version and rescore everything", tag: "Configuration", roles, body: scoringConfigBody, response: scoringConfigSchema },
  async ({ body, user }) => {
    const saved = await withTransaction((client) =>
      saveScoringConfig(client, { weights: body.weights, sourceReliability: body.source_reliability, minAiConfidence: body.min_ai_confidence }, actorName(user)),
    );
    await admin.queueRescoreAll();
    return saved;
  },
);

defineRoute(
  adminRouter,
  { method: "get", path: "/config/ranking", summary: "Active recommendation ranking weights (RANK_Vn)", tag: "Configuration", roles, response: rankingConfigSchema },
  async () => getActiveRankingConfig(getPool()),
);

defineRoute(
  adminRouter,
  { method: "put", path: "/config/ranking", summary: "Save new ranking weights as a new version", tag: "Configuration", roles, body: rankingConfigBody, response: rankingConfigSchema },
  async ({ body, user }) =>
    withTransaction((client) =>
      saveRankingConfig(
        client,
        {
          weights: body.weights,
          params: {
            relevanceWeights: {
              interests: body.relevance_weights.interests,
              developmentGoals: body.relevance_weights.development_goals,
              regulationGoals: body.relevance_weights.regulation_goals,
              category: body.relevance_weights.category,
            },
            maxPerCreatorInTop: body.max_per_creator_in_top,
            topWindow: body.top_window,
            dismissCooldownDays: body.dismiss_cooldown_days,
            expertNeutral: body.expert_neutral,
          },
        },
        actorName(user),
      ),
    ),
);

defineRoute(
  adminRouter,
  { method: "post", path: "/taxonomy", summary: "Add or update a vocabulary term (e.g. a new category)", tag: "Taxonomy", roles, body: taxonomyBody, response: z.object({ saved: z.boolean() }), status: 201 },
  async ({ body }) => {
    await upsertTaxonomyTerm(getPool(), { kind: body.kind, key: body.key, label: body.label, sortOrder: body.sort_order, active: body.active, meta: body.meta });
    return { saved: true };
  },
);
