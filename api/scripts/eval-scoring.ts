// Calibration report (docs/recommendation/README.md "Calibration"): how closely the AI agrees with
// admins on the items both have judged. It reads stored assessments only and makes no Gemini calls.
//   npm run eval:scoring -w api
import { closePool, getPool } from "../src/db/pool";
import { computeKidqScore, PUBLISH_MIN_SCORE, rejectionFindings } from "../src/domain/scoring";
import { loadAssessments } from "../src/repositories/assessments";
import { getActiveScoringConfig } from "../src/repositories/config";

// Targets before "Ready to approve" is trusted without a second look.
const TARGET_AVERAGE_GAP = 10;
const TARGET_CATEGORY_AGREEMENT = 0.85;
const ENOUGH_LABELLED_ITEMS = 30;

const percent = (value: number) => `${Math.round(value * 100)}%`;
const mark = (ok: boolean) => (ok ? "✓" : "✗");

async function main() {
  const pool = getPool();

  // 1. Component scores: the AI's latest reviewed value against the admin's latest value.
  const components = (
    await pool.query<{ component: string; n: number; gap: string; bias: string }>(
      `WITH latest AS (
         SELECT DISTINCT ON (a.content_item_id, a.assessor_type, s.component) a.content_item_id, a.assessor_type, s.component, s.value
         FROM assessments a JOIN assessment_scores s ON s.assessment_id = a.id
         WHERE s.status = 'MEASURED' AND (a.assessor_type = 'HUMAN' OR (a.assessor_type = 'MODEL' AND a.audiovisual_inspected))
         ORDER BY a.content_item_id, a.assessor_type, s.component, a.created_at DESC)
       SELECT m.component, count(*)::int AS n, avg(abs(m.value - h.value)) AS gap, avg(m.value - h.value) AS bias
       FROM latest m JOIN latest h ON h.content_item_id = m.content_item_id AND h.component = m.component AND h.assessor_type = 'HUMAN'
       WHERE m.assessor_type = 'MODEL' GROUP BY m.component ORDER BY m.component`,
    )
  ).rows;

  // 2. Checks: where an admin answered PASS or FAIL, did the AI agree?
  const checks = (
    await pool.query<{ criterion_key: string; n: number; agree: number; false_fail: number; missed: number }>(
      `WITH latest AS (
         SELECT DISTINCT ON (a.content_item_id, a.assessor_type, c.criterion_key) a.content_item_id, a.assessor_type, c.criterion_key, c.result
         FROM assessments a JOIN assessment_criteria c ON c.assessment_id = a.id
         WHERE a.assessor_type IN ('MODEL', 'HUMAN')
         ORDER BY a.content_item_id, a.assessor_type, c.criterion_key, a.created_at DESC)
       SELECT h.criterion_key, count(*)::int AS n,
         count(*) FILTER (WHERE m.result = h.result)::int AS agree,
         count(*) FILTER (WHERE m.result = 'FAIL' AND h.result = 'PASS')::int AS false_fail,
         count(*) FILTER (WHERE m.result <> 'FAIL' AND h.result = 'FAIL')::int AS missed
       FROM latest h JOIN latest m ON m.content_item_id = h.content_item_id AND m.criterion_key = h.criterion_key AND m.assessor_type = 'MODEL'
       WHERE h.assessor_type = 'HUMAN' AND h.result <> 'UNKNOWN'
       GROUP BY h.criterion_key ORDER BY h.criterion_key`,
    )
  ).rows;

  // 3. Categories an admin set, against the AI's primary category.
  const category = (
    await pool.query<{ n: number; agree: number }>(
      `SELECT count(*)::int AS n, count(*) FILTER (WHERE m.category = ci.category)::int AS agree
       FROM content_items ci
       JOIN LATERAL (SELECT classification->>'category' AS category FROM assessments
                     WHERE content_item_id = ci.id AND assessor_type = 'MODEL' AND classification IS NOT NULL
                     ORDER BY created_at DESC LIMIT 1) m ON true
       WHERE ci.classification_source = 'HUMAN'`,
    )
  ).rows[0];

  // 4. Items an admin rejected that the AI and rules alone would have sent to "Ready to approve".
  const config = await getActiveScoringConfig(pool);
  const rejected = (
    await pool.query<{ id: string; content_type: string }>(
      `SELECT ci.id, ci.content_type FROM content_items ci
       JOIN LATERAL (SELECT decision, decision_source FROM publication_decisions WHERE content_item_id = ci.id ORDER BY decided_at DESC LIMIT 1) d ON true
       WHERE d.decision = 'REJECTED' AND d.decision_source = 'ADMIN'`,
    )
  ).rows;
  const slipped: string[] = [];
  for (const item of rejected) {
    const automated = (await loadAssessments(pool, item.id)).filter((assessment) => assessment.assessorType !== "HUMAN");
    const result = computeKidqScore(automated, config, item.content_type);
    if (result.score !== null && result.score >= PUBLISH_MIN_SCORE && !result.belowConfidence && rejectionFindings(result).length === 0) slipped.push(item.id);
  }
  const labelled = (await pool.query<{ n: number }>("SELECT count(DISTINCT content_item_id)::int AS n FROM assessments WHERE assessor_type = 'HUMAN'")).rows[0].n;

  console.log(`KidQ scoring calibration — ${labelled} item(s) an admin has judged (aim for ${ENOUGH_LABELLED_ITEMS}+)\n`);
  console.log("Component scores (AI minus admin):");
  if (components.length === 0) console.log("  no items scored by both yet");
  for (const row of components) {
    const gap = Number(row.gap);
    console.log(`  ${mark(gap <= TARGET_AVERAGE_GAP)} ${row.component.padEnd(18)} average gap ${gap.toFixed(1)}, bias ${Number(row.bias) >= 0 ? "+" : ""}${Number(row.bias).toFixed(1)} (${row.n} item(s))`);
  }
  console.log("\nChecks the admin answered:");
  if (checks.length === 0) console.log("  none yet");
  for (const row of checks) {
    console.log(`  ${row.criterion_key.padEnd(34)} ${percent(row.agree / row.n)} agree of ${row.n}; AI flagged wrongly ${row.false_fail}, AI missed ${row.missed}`);
  }
  const agreement = category.n ? category.agree / category.n : null;
  console.log(
    `\nCategories: ${agreement === null ? "no admin-set categories yet" : `${mark(agreement >= TARGET_CATEGORY_AGREEMENT)} ${percent(agreement)} agree (${category.n} item(s))`}`,
  );
  console.log(`Rejected by an admin but "Ready" on the AI alone: ${mark(slipped.length === 0)} ${slipped.length} of ${rejected.length}${slipped.length ? ` — ${slipped.join(", ")}` : ""}`);
}

main()
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
