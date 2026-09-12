// Versioned RULE / MODEL / HUMAN assessments with per-component scores and per-criterion
// evidence (README "Model assessment record"). The DB rejects any non-human approval.
import type { Db } from "../db/pool";
import type { SuggestedClassification } from "../domain/analysis/rules";
import { getCriterion } from "../domain/rubric";
import type { AssessmentInput, AssessorType, ComponentInput, CriterionInput } from "../domain/scoring";

export interface NewAssessment {
  contentItemId: string;
  assessorType: AssessorType;
  assessorName: string;
  rubricVersion: string;
  result: "REJECTED" | "MANUAL_REVIEW_REQUIRED";
  summary: string;
  audiovisualInspected: boolean;
  scores: ComponentInput[];
  criteria: CriterionInput[];
  classification?: SuggestedClassification | null;
  modelName?: string | null;
  modelSnapshot?: string | null;
  promptVersion?: string | null;
  inputHash?: string | null;
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  output?: unknown;
  cacheKey?: string | null;
}

export async function insertAssessment(db: Db, assessment: NewAssessment): Promise<string> {
  const id = (
    await db.query<{ id: string }>(
      `INSERT INTO assessments (content_item_id, assessor_type, assessor_name, model_name, model_snapshot, prompt_version,
         rubric_version, input_hash, input_tokens, cached_input_tokens, output_tokens, estimated_cost_usd, result, summary,
         audiovisual_inspected, classification, output, cache_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
      [
        assessment.contentItemId,
        assessment.assessorType,
        assessment.assessorName,
        assessment.modelName ?? null,
        assessment.modelSnapshot ?? null,
        assessment.promptVersion ?? null,
        assessment.rubricVersion,
        assessment.inputHash ?? null,
        assessment.inputTokens ?? null,
        assessment.cachedInputTokens ?? null,
        assessment.outputTokens ?? null,
        assessment.estimatedCostUsd ?? null,
        assessment.result,
        assessment.summary,
        assessment.audiovisualInspected,
        assessment.classification ? JSON.stringify(assessment.classification) : null,
        assessment.output === undefined ? null : JSON.stringify(assessment.output),
        assessment.cacheKey ?? null,
      ],
    )
  ).rows[0].id;

  for (const score of assessment.scores) {
    await db.query(
      `INSERT INTO assessment_scores (assessment_id, component, value, status, self_confidence, evidence, timestamps)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, score.component, score.value, score.status, score.selfConfidence, score.evidence, score.timestamps],
    );
  }
  for (const criterion of assessment.criteria) {
    const definition = getCriterion(criterion.key);
    if (!definition) continue; // Unknown keys never reach the rubric tables.
    await db.query(
      `INSERT INTO assessment_criteria (assessment_id, criterion_key, criterion_group, result, evidence, timestamps)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (assessment_id, criterion_key) DO NOTHING`,
      [id, criterion.key, definition.group, criterion.result, criterion.evidence, criterion.timestamps],
    );
  }
  return id;
}

export async function loadAssessments(db: Db, contentItemId: string): Promise<AssessmentInput[]> {
  const { rows } = await db.query(
    `SELECT a.id, a.assessor_type, a.created_at,
       COALESCE((SELECT json_agg(json_build_object('component', s.component, 'value', s.value, 'status', s.status,
                  'selfConfidence', s.self_confidence, 'evidence', s.evidence, 'timestamps', s.timestamps))
                 FROM assessment_scores s WHERE s.assessment_id = a.id), '[]') AS scores,
       COALESCE((SELECT json_agg(json_build_object('key', c.criterion_key, 'result', c.result, 'evidence', c.evidence,
                  'timestamps', c.timestamps))
                 FROM assessment_criteria c WHERE c.assessment_id = a.id), '[]') AS criteria
     FROM assessments a WHERE a.content_item_id = $1 ORDER BY a.created_at DESC`,
    [contentItemId],
  );
  return rows.map((row) => ({
    id: row.id,
    assessorType: row.assessor_type,
    createdAt: new Date(row.created_at),
    scores: (row.scores as ComponentInput[]).map((score) => ({
      ...score,
      value: score.value === null ? null : Number(score.value),
      selfConfidence: score.selfConfidence === null ? null : Number(score.selfConfidence),
    })),
    criteria: row.criteria as CriterionInput[],
  }));
}

export async function hasModelAssessment(db: Db, contentItemId: string, cacheKey: string): Promise<boolean> {
  const { rowCount } = await db.query(
    "SELECT 1 FROM assessments WHERE content_item_id = $1 AND assessor_type = 'MODEL' AND cache_key = $2 LIMIT 1",
    [contentItemId, cacheKey],
  );
  return (rowCount ?? 0) > 0;
}
