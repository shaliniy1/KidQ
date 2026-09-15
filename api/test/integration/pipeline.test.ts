import "../fixtures/test-env";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pacificDay } from "../../src/ai/scoring-agent";
import { runMigrations } from "../../src/db/migrate";
import { closePool, getPool } from "../../src/db/pool";
import { recordDecision } from "../../src/repositories/decisions";
import { reanalyze } from "../../src/services/admin";
import { createIngestionRun, getIngestionRun } from "../../src/services/ingestion";
import { drainQueue } from "../../src/services/worker";
import {
  agentOutput,
  fakeApis,
  geminiQuotaError,
  installFakeApis,
  storyAgentOutput,
  storyweaverBook,
  youtubeVideo,
  type FakeApis,
} from "../fixtures/sources";

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
    // 0.8 for an AI score × the AI's 0.9 certainty, with every sight and sound check answered.
    expect(Number(record.kidq_confidence)).toBe(0.72);
    expect(record.publish_blockers).toEqual([]);
    expect(record.categories).toEqual(["maths"]);
    expect(record.learning_value).toBe(25);

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
    expect(record.studio_state).toBe("NEEDS_ATTENTION");
    expect(record.publish_blockers).toContain("MISSING_COMPONENTS");
    const gap = (await pool.query("SELECT summary FROM assessments WHERE assessor_type = 'MODEL'")).rows[0];
    expect(gap.summary).toMatch(/^AI review not completed/);
    expect(geminiCalls(apis)).toBe(2);
  });

  it("withholds the score and rejects the item when the AI confirms a critical safety problem", async () => {
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
    expect(record.studio_state).toBe("REJECTED");
    const model = (await pool.query("SELECT result FROM assessments WHERE assessor_type = 'MODEL'")).rows[0];
    expect(model.result).toBe("REJECTED");
    const decision = (await pool.query("SELECT decision, decision_source, reason FROM publication_decisions")).rows;
    expect(decision).toEqual([{ decision: "REJECTED", decision_source: "SYSTEM", reason: "KidQ checks: safety: physical violence at 01:12." }]);
  });

  it("rejects a video whose colours the AI saw as harsh, capping its visual comfort", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO, { title: "Rainbow colours compilation" }));
    apis.gemini.push(agentOutput({ observations: { palette: "HARSH" } }));
    installFakeApis(apis);

    await importUrls([VIDEO]);

    const record = await item();
    const visual = (await pool.query("SELECT components FROM kidq_scores ORDER BY created_at DESC LIMIT 1")).rows[0].components.components.find(
      (component: { component: string }) => component.component === "VISUAL_COMFORT",
    );
    // The AI said 89; its own observation bounds it to 45, and the failed contrast check caps it at 40.
    expect(visual).toMatchObject({ value: 40, cap: { criterion: "flashing_or_excessive_contrast", max: 40 } });
    expect(record.publish_blockers).toContain("EXCLUDED");
    expect(record.studio_state).toBe("REJECTED");
    const decision = (await pool.query("SELECT decision_source, reason FROM publication_decisions")).rows[0];
    expect(decision).toEqual({ decision_source: "SYSTEM", reason: "KidQ checks: flashing or excessive contrast." });
  });

  it("sends a keyword-flagged video to the AI, which clears it", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO, { title: "Pillow fight song" }));
    apis.gemini.push(agentOutput());
    installFakeApis(apis);

    await importUrls([VIDEO]);

    const record = await item();
    expect(geminiCalls(apis)).toBe(1);
    expect(record).toMatchObject({ has_critical_flag: false, studio_state: "READY_TO_APPROVE" });
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

  it("pauses AI scoring until the daily reset when every model's daily quota is used up, then resumes", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO));
    apis.youtube.set("BBBBBBBBBBB", youtubeVideo("BBBBBBBBBBB", { title: "Gentle shapes" }));
    apis.gemini.push(geminiQuotaError(), geminiQuotaError());
    installFakeApis(apis);

    await importUrls([VIDEO, "BBBBBBBBBBB"]);

    // The first item used up the scoring model and its fallback; the second saw both paused and never called Gemini.
    expect(geminiCalls(apis)).toBe(2);
    const jobs = (await pool.query("SELECT status, available_at > now() AS later FROM outbox_events WHERE event_type = 'ANALYZE'")).rows;
    expect(jobs).toEqual([
      { status: "PENDING", later: true },
      { status: "PENDING", later: true },
    ]);
    const statuses = async () => (await pool.query("SELECT analysis_status FROM content_items")).rows.map((row) => row.analysis_status);
    expect(await statuses()).toEqual(["QUEUED", "QUEUED"]);
    expect((await pool.query("SELECT model, quota_exhausted_at IS NOT NULL AS paused FROM ai_usage_daily ORDER BY model")).rows).toEqual([
      { model: "gemini-3.7-flash", paused: true },
      { model: "gemini-3.8-flash", paused: true },
    ]);

    // Next day the quota is back: both items are scored, each with a single rule check.
    await pool.query("DELETE FROM ai_usage_daily");
    await pool.query("UPDATE outbox_events SET available_at = now() WHERE event_type = 'ANALYZE'");
    apis.gemini.push(agentOutput(), agentOutput());
    await drainQueue();

    expect(await statuses()).toEqual(["ASSESSED", "ASSESSED"]);
    const assessors = (await pool.query("SELECT array_agg(assessor_type::text ORDER BY created_at) AS types FROM assessments GROUP BY content_item_id")).rows;
    expect(assessors).toEqual([{ types: ["RULE", "MODEL"] }, { types: ["RULE", "MODEL"] }]);
  });

  it("moves to the next Flash model when one's daily quota runs out or it's overloaded", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO));
    apis.youtube.set("BBBBBBBBBBB", youtubeVideo("BBBBBBBBBBB", { title: "Gentle shapes" }));
    const overloaded = { status: 503, body: { error: { code: 503, status: "UNAVAILABLE", message: "The model is overloaded." } } };
    // Item 1: the scoring model's daily quota is used up, so the fallback scores it.
    // Item 2: the fallback is overloaded (three tries) and no other model is left today, so the item waits a few minutes.
    apis.gemini.push(geminiQuotaError(), agentOutput(), overloaded, overloaded, overloaded);
    installFakeApis(apis);

    await importUrls([VIDEO, "BBBBBBBBBBB"]);

    const models = apis.calls.filter((url) => url.includes(":generateContent")).map((url) => url.match(/models\/([^:]+):generateContent/)?.[1]);
    expect(models).toEqual(["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.7-flash", "gemini-3.7-flash", "gemini-3.7-flash"]);
    expect((await pool.query("SELECT model_name FROM assessments WHERE assessor_type = 'MODEL'")).rows).toEqual([{ model_name: "gemini-3.7-flash" }]);
    const waiting = (
      await pool.query(
        `SELECT e.status, e.attempt_count, e.available_at > now() AS later, e.last_error FROM outbox_events e
         JOIN source_records s ON s.content_item_id = e.aggregate_id WHERE e.event_type = 'ANALYZE' AND s.external_id = 'BBBBBBBBBBB'`,
      )
    ).rows[0];
    // An overload is Google's problem, not the item's: it waits without using up a retry.
    expect(waiting).toMatchObject({ status: "PENDING", attempt_count: 0, later: true });
    expect(waiting.last_error).toMatch(/overloaded/);
  });

  it("imports an openly licensed StoryWeaver book, stores its pages and scores it without audio", async () => {
    const apis = fakeApis();
    const book = storyweaverBook(9001);
    const closed = storyweaverBook(9002, { license: "CC BY-NC-ND 4.0", title: "Closed book" });
    apis.storyweaver.hits.push(book.hit, closed.hit);
    apis.storyweaver.reads.set(book.hit.slug, book.pages);
    apis.storyweaver.reads.set(closed.hit.slug, closed.pages);
    apis.gemini.push(storyAgentOutput());
    installFakeApis(apis);

    const runId = await createIngestionRun(pool, {
      sourceSystemId: "storyweaver",
      query: { mode: "search", queries: [{ query: "rain", maxResults: 5 }] },
      requestedBy: "test",
    });
    await drainQueue();

    const run = await getIngestionRun(pool, runId);
    expect(run).toMatchObject({ status: "SUCCEEDED", records_seen: 2, records_created: 1, records_rejected_before_ai: 1 });
    expect(run?.errors.map((error: { code: string }) => error.code)).toEqual(["REJECTED_LICENSE_NOT_OPEN"]);

    const record = await item();
    expect(record).toMatchObject({
      content_type: "STORYBOOK",
      source: "storyweaver",
      license_name: "CC BY 4.0",
      analysis_status: "ASSESSED",
      studio_state: "READY_TO_APPROVE",
      category: "storybooks",
    });
    // (0.40×92 + 0.25×85 + 0.20×88) / 0.85: a picture book has no audio component.
    expect(Number(record.kidq_score)).toBe(89);
    const story = (await pool.query("SELECT story FROM source_records")).rows[0].story;
    expect(story.pages.map((page: { text: string }) => page.text)).toEqual(["On Sunday, Manu's parents got him a red raincoat.", "At last it rained, and Manu danced."]);
    const labels = (await pool.query("SELECT components FROM kidq_scores ORDER BY created_at DESC LIMIT 1")).rows[0].components.components.map(
      (component: { label: string }) => component.label,
    );
    expect(labels).toEqual(["Content & language", "Reading pace", "Illustrations"]);
    // The AI read both pages and saw both illustrations inline.
    expect(apis.calls.filter((url) => url.includes("illustration_crops")).length).toBe(2);
  });

  it("drops discovered items that fail the pre-screen before storing them", async () => {
    const apis = fakeApis();
    const book = storyweaverBook(9003);
    const unsuitable = storyweaverBook(9004, { title: "A Horror Story" });
    apis.storyweaver.hits.push(book.hit, unsuitable.hit);
    apis.storyweaver.reads.set(book.hit.slug, book.pages);
    apis.storyweaver.reads.set(unsuitable.hit.slug, unsuitable.pages);
    apis.gemini.push(storyAgentOutput());
    installFakeApis(apis);

    const runId = await createIngestionRun(pool, {
      sourceSystemId: "storyweaver",
      query: { mode: "search", queries: [{ query: "rain", maxResults: 5 }] },
      requestedBy: "test",
    });
    await drainQueue();

    const run = await getIngestionRun(pool, runId);
    expect(run).toMatchObject({ status: "SUCCEEDED", records_seen: 2, records_created: 1, records_rejected_before_ai: 1 });
    expect(run?.errors).toEqual([expect.objectContaining({ code: "REJECTED_UNSUITABLE", message: "Pre-screen: horror." })]);
    expect((await pool.query("SELECT title FROM content_items")).rows).toEqual([{ title: "A Rainy Day" }]);
  });

  it("spends no AI quota on a rejected item when its source changes", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO));
    apis.gemini.push(agentOutput());
    installFakeApis(apis);
    await importUrls([VIDEO]);
    await recordDecision(pool, (await item()).id, { decision: "REJECTED", reason: "Not for KidQ.", decidedBy: "admin@kidq.test" });

    apis.youtube.set(VIDEO, youtubeVideo(VIDEO, { title: "Calm counting to ten" }));
    await importUrls([VIDEO]);

    expect(geminiCalls(apis)).toBe(1);
    expect(await item()).toMatchObject({ title: "Calm counting to ten", current_status: "REJECTED", analysis_status: "ASSESSED" });
  });

  it("scores an item with the AI once: a source change keeps the score, an admin's re-analyze replaces it", async () => {
    const apis = fakeApis();
    apis.youtube.set(VIDEO, youtubeVideo(VIDEO));
    apis.gemini.push(agentOutput());
    installFakeApis(apis);
    await importUrls([VIDEO]);

    apis.youtube.set(VIDEO, youtubeVideo(VIDEO, { title: "Calm counting to ten" }));
    await importUrls([VIDEO]);
    expect(geminiCalls(apis)).toBe(1);
    expect(await item()).toMatchObject({ title: "Calm counting to ten", analysis_status: "ASSESSED" });

    apis.gemini.push(agentOutput());
    await reanalyze((await item()).id);
    await drainQueue();
    expect(geminiCalls(apis)).toBe(2);
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
