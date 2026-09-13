// Recompute an item's content score from all its assessments and keep the fast-read
// projection on content_items (score, confidence, learning value, critical flag, publish
// blockers) in step. Call inside the same transaction as whatever changed the inputs.
import type { Db } from "../db/pool";
import { computeKidqScore, publishBlockers, rejectionFindings, type KidqScoreResult, type ScoringConfig } from "../domain/scoring";
import { loadAssessments } from "../repositories/assessments";
import { getActiveScoringConfig } from "../repositories/config";
import { recordDecision, type Decision } from "../repositories/decisions";

const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));

export async function rescoreItem(db: Db, contentItemId: string, config?: ScoringConfig): Promise<KidqScoreResult> {
  const scoring = config ?? (await getActiveScoringConfig(db));
  const item = (
    await db.query(
      `SELECT ci.content_type, ci.age_min, ci.age_max, ci.category, ci.development_goals, ci.regulation_goals,
         COALESCE(sr.available, false) AS available, sr.embeddable, COALESCE(sr.has_story, false) AS has_story, ra.allows_embedding
       FROM content_items ci
       LEFT JOIN LATERAL (SELECT id, available, embeddable, story IS NOT NULL AS has_story FROM source_records
                          WHERE content_item_id = ci.id ORDER BY fetched_at DESC LIMIT 1) sr ON true
       LEFT JOIN LATERAL (SELECT allows_embedding FROM rights_assertions
                          WHERE source_record_id = sr.id ORDER BY checked_at DESC LIMIT 1) ra ON true
       WHERE ci.id = $1`,
      [contentItemId],
    )
  ).rows[0];
  if (!item) throw new Error(`Content item ${contentItemId} not found`);
  const result = computeKidqScore(await loadAssessments(db, contentItemId), scoring, item.content_type);

  const blockers = publishBlockers(
    result,
    {
      ageMin: toNumber(item.age_min),
      ageMax: toNumber(item.age_max),
      category: item.category,
      developmentGoals: item.development_goals,
      regulationGoals: item.regulation_goals,
    },
    {
      // A picture book can be read once its pages are stored.
      available: item.available && (item.content_type !== "STORYBOOK" || item.has_story),
      // Unknown embedding rights mean "not playable" (README rights model).
      embeddable: item.embeddable === false || item.allows_embedding !== true ? false : item.embeddable,
    },
  );

  await db.query(
    `INSERT INTO kidq_scores (content_item_id, scoring_version, score, confidence, components, missing, blocked_by_safety, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      contentItemId,
      result.version,
      result.score,
      result.confidence,
      JSON.stringify({
        components: result.components,
        safetyFlags: result.safetyFlags,
        exclusions: result.exclusions,
        lowConfidence: result.lowConfidence,
        learning: result.learning,
      }),
      result.missing,
      result.blockedBySafety,
      result.reason,
    ],
  );
  await db.query(
    `UPDATE content_items SET kidq_score = $2, kidq_confidence = $3, kidq_score_version = $4,
       has_critical_flag = $5, publish_blockers = $6, learning_value = $7, updated_at = now()
     WHERE id = $1`,
    [contentItemId, result.score, result.confidence, result.version, result.blockedBySafety, blockers, result.learning.value],
  );
  return result;
}

/**
 * KidQ checks after an AI review (docs/recommendation/README.md "Publish policy"): a confirmed
 * problem gets a SYSTEM rejection, or unpublishes an item that was live. Any admin can restore
 * either; an item an admin deliberately kept in review stays there, its problem shown as a blocker.
 */
export async function applyKidqChecks(db: Db, contentItemId: string, result: KidqScoreResult): Promise<Decision | null> {
  const findings = rejectionFindings(result);
  if (findings.length === 0) return null;
  const item = (
    await db.query(
      `SELECT ci.current_status,
         (SELECT decision_source FROM publication_decisions WHERE content_item_id = ci.id ORDER BY decided_at DESC LIMIT 1) AS last_source
       FROM content_items ci WHERE ci.id = $1 FOR UPDATE`,
      [contentItemId],
    )
  ).rows[0];
  if (!item || item.current_status === "REJECTED") return null;
  if (item.current_status !== "APPROVED" && item.last_source === "ADMIN") return null;
  const decision: Decision = item.current_status === "APPROVED" ? "MANUAL_REVIEW_REQUIRED" : "REJECTED";
  await recordDecision(db, contentItemId, { decision, reason: `KidQ checks: ${findings.join("; ")}.`, decidedBy: "kidq-checks", source: "SYSTEM" });
  return decision;
}
