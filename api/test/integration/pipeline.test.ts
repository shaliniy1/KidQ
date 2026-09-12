import "../fixtures/test-env";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pacificDay } from "../../src/ai/scoring-agent";
import { runMigrations } from "../../src/db/migrate";
import { closePool, getPool } from "../../src/db/pool";
import { createIngestionRun, getIngestionRun } from "../../src/services/ingestion";
import { drainQueue } from "../../src/services/worker";
import { agentOutput, fakeApis, installFakeApis, youtubeVideo, type FakeApis } from "../fixtures/sources";

const pool = getPool();
const VIDEO = "AAAAAAAAAAA";

async function importUrls(urls: string[]) {
  const runId = await createIngestionRun(pool, { sourceSystemId: "youtube", query: { mode: "urls", urls }, requestedBy: "test" });
  await drainQueue();
  return runId;
}

const geminiCalls = (apis: FakeApis) => apis.calls.filter((url) => url.includes(":generateContent")).length;
const item = async () => (await pool.query("SELECT * FROM content_records_v")).rows[0];

beforeAll(async () => {
  await runMigrations(pool, () => undefined);
});

beforeEach(async () => {
  await pool.query("TRUNCATE ingestion_runs, content_items, outbox_events, ai_usage_daily, child_profiles CASCADE");
  vi.unstubAllGlobals();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await closePool();
});

describe("content pipeline (fixtures, real Postgres)", () => {
  it("imports URLs, scores with the AI agent, and never approves", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO));
    apis.youtube.set("BBBBBBBBBBB", youtubeVideo("BBBBBBBBBBB", { embeddable: false }));
    apis.gemini.push(agentOutput());
    installFakeApis(apis);

    const runId = await importUrls([`https://youtu.be/${VIDEO}`, "https://www.youtube.com/watch?v=BBBBBBBBBBB", "not-a-url"]);

    const run = await getIngestionRun(pool, runId);
    expect(run).toMatchObject({ status: "PARTIAL", records_seen: 3, records_created: 1, records_rejected_before_ai: 1 });
    expect(run?.errors.map((error: { code: string }) => error.code).sort()).toEqual(["INVALID_URL", "REJECTED_NOT_EMBEDDABLE"]);

    const record = await item();
    expect(record).toMatchObject({
      analysis_status: "ASSESSED",
      studio_state: "READY_TO_APPROVE",
      current_status: "MANUAL_REVIEW_REQUIRED",
      category: "maths",
      classification_source: "MODEL",
      interests: ["numbers"],
      kidq_summary: "A calm counting video with gentle music. Children count along from one to five.",
    });
    expect(Number(record.kidq_score)).toBe(88.8);
    expect(Number(record.kidq_confidence)).toBe(0.8);
    expect(record.publish_blockers).toEqual([]);

    const assessors = (await pool.query("SELECT assessor_type FROM assessments ORDER BY created_at")).rows.map((row) => row.assessor_type);
    expect(assessors).toEqual(["RULE", "MODEL"]);
    const timestamps = (await pool.query("SELECT timestamps FROM assessment_scores WHERE component = 'PACING' AND value IS NOT NULL")).rows[0];
    expect(timestamps.timestamps).toEqual(["00:42"]);
    expect((await pool.query("SELECT count(*)::int AS n FROM publication_decisions")).rows[0].n).toBe(0);
    expect(geminiCalls(apis)).toBe(1);
  });

  it("is idempotent: re-importing an unchanged video skips reanalysis", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO));
    apis.gemini.push(agentOutput());
    installFakeApis(apis);

    await importUrls([VIDEO]);
    const secondRun = await getIngestionRun(pool, await importUrls([`https://www.youtube.com/watch?v=${VIDEO}`]));

    expect(secondRun).toMatchObject({ status: "SUCCEEDED", records_created: 0, records_unchanged: 1 });
    expect((await pool.query("SELECT count(*)::int AS n FROM content_items")).rows[0].n).toBe(1);
    expect(geminiCalls(apis)).toBe(1);
  });

  it("hands the item to the admin when the AI output is invalid twice", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO));
    apis.gemini.push("not json", "{}");
    installFakeApis(apis);

    await importUrls([VIDEO]);

    const record = await item();
    expect(record.analysis_status).toBe("ANALYSIS_INCOMPLETE");
    expect(record.studio_state).toBe("ANALYSIS_INCOMPLETE");
    expect(record.publish_blockers).toContain("MISSING_COMPONENTS");
    const gap = (await pool.query("SELECT summary FROM assessments WHERE assessor_type = 'MODEL'")).rows[0];
    expect(gap.summary).toMatch(/^AI review not completed/);
    expect(geminiCalls(apis)).toBe(2);
  });

  it("withholds the score when the AI reports a critical safety problem", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO));
    apis.gemini.push(
      agentOutput({ criteria: [{ key: "physical_violence", result: "FAIL", evidence: "A character hits another at 01:12.", timestamps: ["01:12"] }] }),
    );
    installFakeApis(apis);

    await importUrls([VIDEO]);

    const record = await item();
    expect(record.has_critical_flag).toBe(true);
    expect(record.kidq_score).toBeNull();
    expect(record.publish_blockers).toContain("CRITICAL_FLAG");
    expect(record.studio_state).toBe("NEEDS_ATTENTION");
    const model = (await pool.query("SELECT result FROM assessments WHERE assessor_type = 'MODEL'")).rows[0];
    expect(model.result).toBe("REJECTED");
  });

  it("defers AI scoring once the free-tier daily video quota is used", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO));
    installFakeApis(apis);
    await pool.query("INSERT INTO ai_usage_daily (day, model, youtube_video_seconds) VALUES ($1, 'gemini-3.8-flash', 27000)", [pacificDay()]);

    await importUrls([VIDEO]);

    expect((await item()).analysis_status).toBe("QUEUED");
    const job = (await pool.query("SELECT status, available_at > now() AS later FROM outbox_events WHERE event_type = 'ANALYZE'")).rows[0];
    expect(job).toEqual({ status: "PENDING", later: true });
    expect(geminiCalls(apis)).toBe(0);
  });

  it("refuses automated approvals at the database level", async () => {
    const id = (await pool.query("INSERT INTO content_items (content_type, title) VALUES ('VIDEO', 'x') RETURNING id")).rows[0].id;
    await expect(
      pool.query(
        "INSERT INTO assessments (content_item_id, assessor_type, assessor_name, rubric_version, result, summary) VALUES ($1, 'MODEL', 'm', '2', 'APPROVED', 's')",
        [id],
      ),
    ).rejects.toThrow(/assessments_no_automated_approval/);
    await expect(
      pool.query(
        "INSERT INTO publication_decisions (content_item_id, decision, reason, decided_by, decision_source) VALUES ($1, 'APPROVED', 'r', 'system', 'SYSTEM')",
        [id],
      ),
    ).rejects.toThrow(/publication_decisions_admin_approval/);
  });
});
