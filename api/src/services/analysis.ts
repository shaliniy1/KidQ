// ANALYZE job: rule pre-checks → AI scoring agent → content score → analysis status.
// Classification suggestions never overwrite what an admin set (HUMAN > MODEL > RULE).
import { runScoringAgent, type AgentTarget } from "../ai/scoring-agent";
import type { DiscoveryHints } from "../connectors/types";
import { getPool, withTransaction, type Db } from "../db/pool";
import { ageBandsFor } from "../domain/age";
import { analyzeWithRules, type SuggestedClassification } from "../domain/analysis/rules";
import { RUBRIC_VERSION } from "../domain/rubric";
import { COMPONENTS } from "../domain/scoring";
import { hasModelAssessment, insertAssessment } from "../repositories/assessments";
import { listTaxonomy } from "../repositories/taxonomy";
import { rescoreItem } from "./scoring";

export type AnalysisResult = { status: "ASSESSED" | "ANALYSIS_INCOMPLETE" } | { status: "DEFERRED"; retryAt: Date };

async function loadTarget(db: Db, contentItemId: string) {
  const row = (
    await db.query(
      `SELECT ci.id, ci.title, ci.description, ci.language, ci.duration_seconds, ci.keywords,
         sr.source_system_id, sr.external_id, sr.media_url, sr.media_mime_type, sr.creator, sr.metadata_hash,
         ra.allows_media_storage
       FROM content_items ci
       JOIN LATERAL (SELECT * FROM source_records WHERE content_item_id = ci.id ORDER BY fetched_at DESC LIMIT 1) sr ON true
       LEFT JOIN LATERAL (SELECT allows_media_storage FROM rights_assertions
                          WHERE source_record_id = sr.id ORDER BY checked_at DESC LIMIT 1) ra ON true
       WHERE ci.id = $1`,
      [contentItemId],
    )
  ).rows[0];
  if (!row) throw new Error(`Content item ${contentItemId} has no source record`);
  const target: AgentTarget = {
    contentItemId,
    sourceSystemId: row.source_system_id,
    externalId: row.external_id,
    mediaUrl: row.media_url,
    mediaMimeType: row.media_mime_type,
    allowsMediaCopy: row.source_system_id !== "youtube" && row.allows_media_storage === true,
    title: row.title,
    description: row.description,
    creator: row.creator,
    durationSeconds: row.duration_seconds,
    metadataHash: row.metadata_hash,
  };
  return { target, language: row.language as string | null, keywords: (row.keywords ?? []) as string[] };
}

/** Apply suggested tags unless a higher-precedence source already set them. */
export async function applySuggestedClassification(
  db: Db,
  contentItemId: string,
  suggestion: SuggestedClassification,
  source: "RULE" | "MODEL",
) {
  const editedField = (field: string) =>
    `EXISTS (SELECT 1 FROM editorial_revisions e WHERE e.content_item_id = $1 AND e.changes ? '${field}')`;
  await db.query(
    `UPDATE content_items SET
       age_min = $2, age_max = $3, age_bands = $4, category = $5, topics = $6, development_goals = $7, regulation_goals = $8,
       language = COALESCE($9, language),
       learning_objective = CASE WHEN ${editedField("learning_objective")} THEN learning_objective ELSE COALESCE($10, learning_objective) END,
       kidq_summary = CASE WHEN ${editedField("kidq_summary")} THEN kidq_summary ELSE COALESCE($11, kidq_summary) END,
       classification_source = $12, updated_at = now()
     WHERE id = $1 AND (classification_source IS NULL OR classification_source = 'RULE' OR (classification_source = 'MODEL' AND $12 = 'MODEL'))`,
    [
      contentItemId,
      suggestion.ageMin,
      suggestion.ageMax,
      ageBandsFor(suggestion.ageMin, suggestion.ageMax),
      suggestion.category,
      suggestion.interests,
      suggestion.developmentGoals,
      suggestion.regulationGoals,
      suggestion.language,
      suggestion.learningObjective,
      suggestion.kidqSummary,
      source,
    ],
  );
}

async function setStatus(contentItemId: string, status: "QUEUED" | "ANALYSING" | "ASSESSED" | "ANALYSIS_INCOMPLETE" | "FAILED") {
  await getPool().query("UPDATE content_items SET analysis_status = $2, updated_at = now() WHERE id = $1", [contentItemId, status]);
}

/** Records why the AI could not score, so admins see it in the audit trail. */
async function recordAgentGap(contentItemId: string, reason: string) {
  await withTransaction(async (client) => {
    await insertAssessment(client, {
      contentItemId,
      assessorType: "MODEL",
      assessorName: "kidq-gemini-scoring-agent",
      rubricVersion: RUBRIC_VERSION,
      result: "MANUAL_REVIEW_REQUIRED",
      summary: `AI review not completed: ${reason}`,
      audiovisualInspected: false,
      scores: COMPONENTS.map((component) => ({ component, value: null, status: "UNAVAILABLE", selfConfidence: null, evidence: reason.slice(0, 300), timestamps: [] })),
      criteria: [],
    });
    await rescoreItem(client, contentItemId);
  });
}

export async function analyzeItem(contentItemId: string, options: { hints?: DiscoveryHints; force?: boolean } = {}): Promise<AnalysisResult> {
  const pool = getPool();
  await setStatus(contentItemId, "ANALYSING");
  try {
    const { target, language, keywords } = await loadTarget(pool, contentItemId);

    // 1. Deterministic pre-checks: free, instant, and never an approval.
    const rules = analyzeWithRules({ title: target.title, description: target.description, tags: keywords, language }, options.hints ?? {});
    await withTransaction(async (client) => {
      await insertAssessment(client, {
        contentItemId,
        assessorType: "RULE",
        assessorName: "kidq-rule-prechecks",
        rubricVersion: RUBRIC_VERSION,
        result: rules.skipAiReason ? "REJECTED" : "MANUAL_REVIEW_REQUIRED",
        summary: rules.summary,
        audiovisualInspected: false,
        scores: rules.scores,
        criteria: rules.criteria,
        classification: rules.classification,
      });
      await applySuggestedClassification(client, contentItemId, rules.classification, "RULE");
      await rescoreItem(client, contentItemId);
    });

    // A rule-level critical flag waits for an admin instead of spending AI quota ("Re-analyze" forces it).
    if (rules.skipAiReason && !options.force) {
      await setStatus(contentItemId, "ASSESSED");
      return { status: "ASSESSED" };
    }

    // 2. AI scoring agent.
    const taxonomy = await listTaxonomy(pool);
    const outcome = await runScoringAgent(pool, target, taxonomy, {
      force: options.force,
      hasCached: (cacheKey) => hasModelAssessment(pool, contentItemId, cacheKey),
    });

    switch (outcome.kind) {
      case "SCORED":
        await withTransaction(async (client) => {
          await insertAssessment(client, outcome.assessment);
          await applySuggestedClassification(client, contentItemId, outcome.classification, "MODEL");
          await rescoreItem(client, contentItemId);
        });
        await setStatus(contentItemId, "ASSESSED");
        return { status: "ASSESSED" };
      case "CACHED":
        await setStatus(contentItemId, "ASSESSED");
        return { status: "ASSESSED" };
      case "QUOTA_EXHAUSTED":
        await setStatus(contentItemId, "QUEUED");
        return { status: "DEFERRED", retryAt: outcome.retryAt };
      case "DISABLED":
        await setStatus(contentItemId, "ANALYSIS_INCOMPLETE");
        return { status: "ANALYSIS_INCOMPLETE" };
      case "UNAVAILABLE":
      case "INVALID_OUTPUT":
        await recordAgentGap(contentItemId, outcome.reason);
        await setStatus(contentItemId, "ANALYSIS_INCOMPLETE");
        return { status: "ANALYSIS_INCOMPLETE" };
    }
  } catch (error) {
    // Transient failure: the job retries; the studio shows the item as pending again.
    await setStatus(contentItemId, "QUEUED").catch(() => undefined);
    throw error;
  }
}
