// Admin Content Studio actions (plan: "Admin control model"). Automation only prepares items;
// every visibility change here is an explicit, recorded admin decision.
import type { PoolClient } from "pg";
import { pacificDay } from "../ai/scoring-agent";
import { env } from "../config/env";
import { getPool, withTransaction } from "../db/pool";
import { ageBandsFor } from "../domain/age";
import { RUBRIC_VERSION } from "../domain/rubric";
import { COMPONENTS, type Component, type ComponentInput, type SafetyFlag } from "../domain/scoring";
import { actorName, type AuthUser } from "../http/auth";
import { ApiError, notFound } from "../http/errors";
import type { ClassificationBody, EditorialBody } from "../http/schemas";
import { insertAssessment } from "../repositories/assessments";
import { getAdminDetail } from "../repositories/content";
import { recordDecision, type Decision } from "../repositories/decisions";
import { enqueueJob, NIL_UUID } from "../repositories/jobs";
import { keysOf, listTaxonomy, type TaxonomyKind } from "../repositories/taxonomy";
import { rescoreItem } from "./scoring";

const PLAYBACK_UNAVAILABLE_CODES = [100, 101, 150, 153];

async function lockItem(client: PoolClient, id: string) {
  const row = (await client.query("SELECT * FROM content_items WHERE id = $1 FOR UPDATE", [id])).rows[0];
  if (!row) throw notFound("Content item");
  return row;
}

const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));

async function detail(id: string) {
  const result = await getAdminDetail(getPool(), id);
  if (!result) throw notFound("Content item");
  return result;
}

// ── Scores: an admin's sliders become a HUMAN assessment that outranks the AI ──
export async function submitHumanAssessment(
  user: AuthUser,
  id: string,
  input: {
    scores: Partial<Record<Component, { value: number; evidence: string }>>;
    criteria: Array<{ key: string; result: "PASS" | "FAIL" | "UNKNOWN"; evidence: string }>;
    note?: string;
  },
) {
  const scores: ComponentInput[] = COMPONENTS.flatMap((component) => {
    const slider = input.scores[component];
    return slider ? [{ component, value: slider.value, status: "MEASURED" as const, selfConfidence: null, evidence: slider.evidence, timestamps: [] }] : [];
  });
  if (scores.length === 0 && input.criteria.length === 0) {
    throw new ApiError(400, "NOTHING_TO_SAVE", "Provide at least one score or rubric result.");
  }
  await withTransaction(async (client) => {
    await lockItem(client, id);
    await insertAssessment(client, {
      contentItemId: id,
      assessorType: "HUMAN",
      assessorName: actorName(user),
      rubricVersion: RUBRIC_VERSION,
      result: "MANUAL_REVIEW_REQUIRED",
      summary: input.note ?? `Reviewed by ${actorName(user)}.`,
      audiovisualInspected: true,
      scores,
      criteria: input.criteria.map((criterion) => ({ ...criterion, timestamps: [] })),
    });
    await rescoreItem(client, id);
  });
  return detail(id);
}

// ── Tags ──────────────────────────────────────────────────────────────────────
const CLASSIFICATION_COLUMNS: Record<keyof ClassificationBody, string> = {
  age_min: "age_min",
  age_max: "age_max",
  category: "category",
  subcategory: "subcategory",
  interests: "topics",
  development_goals: "development_goals",
  regulation_goals: "regulation_goals",
  language: "language",
  content_type: "content_type",
};

async function assertKnownKeys(changes: ClassificationBody) {
  const taxonomy = await listTaxonomy(getPool());
  const check = (kind: TaxonomyKind, field: string, values: Array<string | null | undefined>) => {
    const allowed = keysOf(taxonomy, kind);
    const unknown = values.filter((value): value is string => Boolean(value) && !allowed.includes(value as string));
    if (unknown.length) throw new ApiError(400, "UNKNOWN_TAXONOMY_KEY", `Unknown ${field}: ${unknown.join(", ")}. Add it in Configuration first.`, { field, unknown });
  };
  check("category", "category", [changes.category]);
  check("interest", "interests", changes.interests ?? []);
  check("development_goal", "development_goals", changes.development_goals ?? []);
  check("regulation_goal", "regulation_goals", changes.regulation_goals ?? []);
}

async function applyClassification(client: PoolClient, user: AuthUser, id: string, changes: ClassificationBody) {
  const current = await lockItem(client, id);
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [field, column] of Object.entries(CLASSIFICATION_COLUMNS) as Array<[keyof ClassificationBody, string]>) {
    if (!(field in changes)) continue;
    const after = changes[field] ?? null;
    diff[field] = { before: current[column] instanceof Array ? current[column] : (current[column] ?? null), after };
    params.push(after ?? (column === "topics" || column.endsWith("_goals") ? [] : null));
    sets.push(`${column} = $${params.length}`);
  }
  const ageMin = "age_min" in changes ? (changes.age_min ?? null) : toNumber(current.age_min);
  const ageMax = "age_max" in changes ? (changes.age_max ?? null) : toNumber(current.age_max);
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) throw new ApiError(400, "INVALID_AGE_RANGE", "age_min must not exceed age_max.");
  params.push(ageBandsFor(ageMin, ageMax));
  sets.push(`age_bands = $${params.length}`, "classification_source = 'HUMAN'", "updated_at = now()");
  await client.query(`UPDATE content_items SET ${sets.join(", ")} WHERE id = $1`, params);
  await client.query("INSERT INTO editorial_revisions (content_item_id, changes, edited_by, edited_by_user_id) VALUES ($1, $2, $3, $4)", [
    id,
    JSON.stringify({ classification: diff }),
    actorName(user),
    user.id,
  ]);
  await rescoreItem(client, id);
}

export async function updateClassification(user: AuthUser, id: string, changes: ClassificationBody) {
  await assertKnownKeys(changes);
  await withTransaction((client) => applyClassification(client, user, id, changes));
  return detail(id);
}

export async function bulkClassify(user: AuthUser, ids: string[], changes: ClassificationBody) {
  await assertKnownKeys(changes);
  const results = [];
  for (const id of [...new Set(ids)]) {
    try {
      await withTransaction((client) => applyClassification(client, user, id, changes));
      results.push({ content_item_id: id, ok: true, blockers: [], message: null });
    } catch (error) {
      results.push({ content_item_id: id, ok: false, blockers: [], message: error instanceof ApiError ? error.message : "Update failed." });
    }
  }
  return { results };
}

// ── Editorial text (source metadata stays untouched in source_records) ─────────
export async function editEditorial(user: AuthUser, id: string, changes: EditorialBody) {
  await withTransaction(async (client) => {
    const current = await lockItem(client, id);
    const diff: Record<string, { before: unknown; after: unknown }> = {};
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const field of ["title", "kidq_summary", "description", "learning_objective"] as const) {
      if (!(field in changes)) continue;
      diff[field] = { before: current[field] ?? null, after: changes[field] ?? null };
      params.push(changes[field] ?? null);
      sets.push(`${field} = $${params.length}`);
    }
    await client.query(`UPDATE content_items SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, params);
    await client.query("INSERT INTO editorial_revisions (content_item_id, changes, edited_by, edited_by_user_id) VALUES ($1, $2, $3, $4)", [
      id,
      JSON.stringify(diff),
      actorName(user),
      user.id,
    ]);
  });
  return detail(id);
}

// ── Publishing: the admin gate ────────────────────────────────────────────────
async function currentSafetyFlags(client: PoolClient, id: string): Promise<SafetyFlag[]> {
  const row = (await client.query("SELECT components FROM kidq_scores WHERE content_item_id = $1 ORDER BY created_at DESC LIMIT 1", [id])).rows[0];
  return (row?.components?.safetyFlags as SafetyFlag[] | undefined) ?? [];
}

async function publishInTransaction(
  client: PoolClient,
  user: AuthUser,
  id: string,
  input: { decision: Decision; reason: string; overrideCriticalFlag: boolean },
) {
  let item = await lockItem(client, id);
  let overrode = false;
  if (input.decision === "APPROVED") {
    let blockers: string[] = item.publish_blockers ?? [];
    if (blockers.includes("CRITICAL_FLAG")) {
      if (!input.overrideCriticalFlag) {
        throw new ApiError(422, "CRITICAL_FLAG", "A safety flag is unresolved. Resolve it in the rubric, or override it with a written reason.", { blockers });
      }
      if (input.reason.trim().length < 15) throw new ApiError(422, "REASON_TOO_SHORT", "Explain the override in at least 15 characters.", { blockers });
      // An override is recorded as a human rubric result, so the score is computed and auditable.
      const flags = await currentSafetyFlags(client, id);
      await insertAssessment(client, {
        contentItemId: id,
        assessorType: "HUMAN",
        assessorName: actorName(user),
        rubricVersion: RUBRIC_VERSION,
        result: "MANUAL_REVIEW_REQUIRED",
        summary: `Safety flag overridden: ${input.reason}`,
        audiovisualInspected: true,
        scores: [],
        criteria: flags.map((flag) => ({ key: flag.key, result: "PASS" as const, evidence: `Admin override: ${input.reason}`, timestamps: [] })),
      });
      await rescoreItem(client, id);
      item = await lockItem(client, id);
      blockers = item.publish_blockers ?? [];
      overrode = true;
    }
    if (blockers.length) throw new ApiError(422, "NOT_READY", "This item can't be published yet.", { blockers });
  }
  await recordDecision(client, id, {
    decision: input.decision,
    reason: input.reason,
    decidedBy: actorName(user),
    decidedByUserId: user.id,
    source: "ADMIN",
    overrodeCriticalFlag: overrode,
  });
  // Parents who asked for this item see it in their child's library as soon as it is approved.
  if (input.decision === "APPROVED") {
    await client.query("UPDATE library_items SET state = 'ADDED', updated_at = now() WHERE content_item_id = $1 AND state = 'REQUESTED'", [id]);
  }
}

export async function decide(user: AuthUser, id: string, input: { decision: Decision; reason: string; override_critical_flag: boolean }) {
  await withTransaction((client) =>
    publishInTransaction(client, user, id, { decision: input.decision, reason: input.reason, overrideCriticalFlag: input.override_critical_flag }),
  );
  return detail(id);
}

/** Bulk never overrides safety flags: blocked items are skipped and reported. */
export async function bulkDecide(user: AuthUser, ids: string[], decision: Decision, reason: string) {
  const results = [];
  for (const id of [...new Set(ids)]) {
    try {
      await withTransaction((client) => publishInTransaction(client, user, id, { decision, reason, overrideCriticalFlag: false }));
      results.push({ content_item_id: id, ok: true, blockers: [], message: null });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const blockers = ((error.details as { blockers?: string[] } | undefined)?.blockers ?? []) as string[];
      results.push({ content_item_id: id, ok: false, blockers, message: error.message });
    }
  }
  return { results };
}

// ── Expert reviews, re-analysis, playback reports ─────────────────────────────
export async function addExpertReview(
  user: AuthUser,
  id: string,
  review: {
    reviewer_name: string;
    reviewer_type: string;
    credentials?: string | null;
    recommendation: "RECOMMEND" | "NOT_RECOMMEND";
    recommended_age_min?: number | null;
    recommended_age_max?: number | null;
    comments?: string | null;
    source_url: string;
    verified: boolean;
  },
) {
  await withTransaction(async (client) => {
    await lockItem(client, id);
    await client.query(
      `INSERT INTO expert_reviews (content_item_id, reviewer_name, reviewer_type, credentials, recommendation,
         recommended_age_min, recommended_age_max, comments, source_url, verified, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        review.reviewer_name,
        review.reviewer_type,
        review.credentials ?? null,
        review.recommendation,
        review.recommended_age_min ?? null,
        review.recommended_age_max ?? null,
        review.comments ?? null,
        review.source_url,
        review.verified,
        actorName(user),
      ],
    );
  });
  return detail(id);
}

export async function reanalyze(id: string) {
  const pool = getPool();
  const exists = (await pool.query("SELECT 1 FROM content_items WHERE id = $1", [id])).rowCount;
  if (!exists) throw notFound("Content item");
  await pool.query("UPDATE content_items SET analysis_status = 'QUEUED', updated_at = now() WHERE id = $1", [id]);
  await enqueueJob(pool, { type: "ANALYZE", aggregateType: "content_item", aggregateId: id, payload: { force: true }, priority: 5, dedupeKey: `analyze:${id}` });
  return { queued: true };
}

/** A player report only queues a re-check; content is hidden only if YouTube confirms it's gone. */
export async function reportPlaybackError(id: string, code: number) {
  const pool = getPool();
  const exists = (await pool.query("SELECT 1 FROM content_items WHERE id = $1", [id])).rowCount;
  if (!exists) throw notFound("Content item");
  if (!PLAYBACK_UNAVAILABLE_CODES.includes(code)) return { queued: false };
  await enqueueJob(pool, { type: "VERIFY_AVAILABILITY", aggregateType: "content_item", aggregateId: id, priority: 5, dedupeKey: `verify:${id}` });
  return { queued: true };
}

export async function queueRescoreAll() {
  await enqueueJob(getPool(), { type: "RESCORE_ALL", aggregateType: "system", aggregateId: NIL_UUID, priority: 1, dedupeKey: "rescore_all" });
}

export async function dashboard() {
  const pool = getPool();
  const [states, sources, flagged, queue, ai] = await Promise.all([
    pool.query("SELECT studio_state, count(*)::int AS n FROM content_records_v GROUP BY studio_state"),
    pool.query("SELECT source, count(*)::int AS n FROM content_records_v GROUP BY source"),
    pool.query("SELECT count(*)::int AS n FROM content_items WHERE has_critical_flag"),
    pool.query(
      "SELECT event_type, status, count(*)::int AS n FROM outbox_events WHERE status IN ('PENDING', 'PROCESSING', 'FAILED') GROUP BY event_type, status",
    ),
    pool.query(
      "SELECT COALESCE(SUM(youtube_video_seconds), 0)::int AS youtube_seconds, COALESCE(SUM(requests), 0)::int AS requests FROM ai_usage_daily WHERE day = $1",
      [pacificDay()],
    ),
  ]);
  const byState = Object.fromEntries(states.rows.map((row) => [row.studio_state, row.n]));
  return {
    total: states.rows.reduce((sum, row) => sum + row.n, 0),
    by_state: byState,
    by_source: Object.fromEntries(sources.rows.map((row) => [row.source, row.n])),
    flagged: flagged.rows[0].n,
    queue: queue.rows,
    ai_today: {
      youtube_video_seconds: ai.rows[0].youtube_seconds,
      daily_cap_seconds: env.aiDailyVideoSecondsCap,
      requests: ai.rows[0].requests,
      enabled: Boolean(env.geminiApiKey),
    },
  };
}
