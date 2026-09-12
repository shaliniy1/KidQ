import "../fixtures/test-env";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { runMigrations } from "../../src/db/migrate";
import { closePool, getPool } from "../../src/db/pool";
import { createIngestionRun } from "../../src/services/ingestion";
import { drainQueue } from "../../src/services/worker";
import { agentOutput, fakeApis, installFakeApis, youtubeVideo, type FakeApis } from "../fixtures/sources";

const app = createApp();
const pool = getPool();
const ADMIN = "Bearer dev:admin:11111111-1111-4111-8111-111111111111:admin@kidq.test";
const PARENT_A = "Bearer dev:parent:22222222-2222-4222-8222-222222222222";
const PARENT_B = "Bearer dev:parent:33333333-3333-4333-8333-333333333333";

let apis: FakeApis;

async function importVideo(id: string, gemini: string[] = [agentOutput()]) {
  apis.youtube.set(id, youtubeVideo(id));
  apis.gemini.push(...gemini);
  await createIngestionRun(pool, { sourceSystemId: "youtube", query: { mode: "urls", urls: [id] }, requestedBy: "test" });
  await drainQueue();
  return (await pool.query("SELECT content_item_id FROM source_records WHERE external_id = $1", [id])).rows[0].content_item_id as string;
}

async function createChild(auth: string, overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const response = await request(app)
    .post("/children")
    .set("Authorization", auth)
    .send({
      nickname: "Mia",
      birth_year: now.getUTCFullYear() - 3,
      birth_month: now.getUTCMonth() + 1,
      interests: ["numbers", "animals"],
      development_goals: ["cognitive"],
      regulation_goals: ["calm"],
      ...overrides,
    });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

const publish = (id: string, body: Record<string, unknown>) =>
  request(app).post(`/content-items/${id}/publication-decisions`).set("Authorization", ADMIN).send(body);

beforeAll(async () => {
  await runMigrations(pool, () => undefined);
});

beforeEach(async () => {
  await pool.query("TRUNCATE ingestion_runs, content_items, outbox_events, ai_usage_daily, child_profiles CASCADE");
  vi.unstubAllGlobals();
  apis = fakeApis();
  installFakeApis(apis);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await closePool();
});

describe("API", () => {
  it("requires sign-in and the right role", async () => {
    expect((await request(app).get("/content-items")).status).toBe(401);
    expect((await request(app).get("/content-items").set("Authorization", PARENT_A)).status).toBe(403);
    expect((await request(app).get("/content-items").set("Authorization", ADMIN)).status).toBe(200);
    expect((await request(app).get("/taxonomy")).status).toBe(200);
  });

  it("publishes only on an admin decision, then recommends and unpublishes", async () => {
    const id = await importVideo("AAAAAAAAAAA");
    const list = await request(app).get("/content-items").set("Authorization", ADMIN);
    expect(list.body.items[0]).toMatchObject({ id, studio_state: "READY_TO_APPROVE", current_status: "MANUAL_REVIEW_REQUIRED" });
    expect(list.body.items[0].content_score).toMatchObject({ score: 88.8, evaluated_by: "AI" });
    expect(list.body.items[0].content_score.breakdown.map((c: { source: string }) => c.source)).toEqual(["AI", "AI", "AI", "AI"]);

    const childId = await createChild(PARENT_A);
    const recommendations = () => request(app).get(`/children/${childId}/recommendations`).set("Authorization", PARENT_A);
    expect((await recommendations()).body.items).toEqual([]);

    const approved = await publish(id, { decision: "APPROVED", reason: "Calm and clear counting." });
    expect(approved.status).toBe(201);
    expect(approved.body.content.current_status).toBe("APPROVED");

    const recommended = await recommendations();
    expect(recommended.body.items).toHaveLength(1);
    expect(recommended.body.items[0].card.player).toMatchObject({ provider: "youtube", video_id: "AAAAAAAAAAA" });
    expect(recommended.body.items[0].why).toContain("Matches interests: Numbers & counting");
    expect(recommended.body.items[0].card.content_score.evaluated_by).toBe("AI, reviewed by KidQ admin");

    const added = await request(app).post(`/children/${childId}/library`).set("Authorization", PARENT_A).send({ content_item_id: id });
    expect(added.body).toMatchObject({ state: "ADDED", awaiting_review: false });
    expect((await request(app).get(`/children/${childId}/library`).set("Authorization", PARENT_A)).body.items).toHaveLength(1);

    await publish(id, { decision: "MANUAL_REVIEW_REQUIRED", reason: "Unpublish for another look." });
    expect((await request(app).get(`/children/${childId}/library`).set("Authorization", PARENT_A)).body.items).toEqual([]);
    expect((await recommendations()).body.items).toEqual([]);
  });

  it("blocks publishing until the item is ready; bulk skips blocked items", async () => {
    const incomplete = await importVideo("CCCCCCCCCCC", ["not json", "{}"]);
    const blocked = await publish(incomplete, { decision: "APPROVED", reason: "Trying early." });
    expect(blocked.status).toBe(422);
    // Rule checks already suggested age 2–4 from the "toddlers" tag; the AI scores are what's missing.
    expect(blocked.body.error.details.blockers).toEqual(["MISSING_COMPONENTS"]);

    const ready = await importVideo("AAAAAAAAAAA");
    const bulk = await request(app)
      .post("/publication-decisions/bulk")
      .set("Authorization", ADMIN)
      .send({ content_item_ids: [ready, incomplete], decision: "APPROVED", reason: "Batch review done." });
    expect(bulk.body.results).toEqual([
      { content_item_id: ready, ok: true, blockers: [], message: null },
      expect.objectContaining({ content_item_id: incomplete, ok: false }),
    ]);

    const slider = (value: number) => ({ value, evidence: "Watched the full video." });
    await request(app)
      .post(`/content-items/${incomplete}/assessments`)
      .set("Authorization", ADMIN)
      .send({ scores: { CONTENT_LANGUAGE: slider(90), PACING: slider(80), VISUAL_COMFORT: slider(85), AUDIO_COMFORT: slider(88) } })
      .expect(201);
    const tagged = await request(app)
      .patch(`/content-items/${incomplete}/classification`)
      .set("Authorization", ADMIN)
      .send({ age_min: 2, age_max: 4, category: "maths", development_goals: ["cognitive"] });
    expect(tagged.body.content.publish_blockers).toEqual([]);
    expect(tagged.body.content.content_score.evaluated_by).toBe("KidQ admin");
    expect((await publish(incomplete, { decision: "APPROVED", reason: "Rated and tagged by hand." })).status).toBe(201);
    expect(tagged.body.revisions[0].changes).toHaveProperty("classification");
  });

  it("needs an explicit, explained override to publish over a safety flag", async () => {
    const id = await importVideo("AAAAAAAAAAA", [
      agentOutput({ criteria: [{ key: "physical_violence", result: "FAIL", evidence: "Pillow fight at 01:12.", timestamps: ["01:12"] }] }),
    ]);
    expect((await publish(id, { decision: "APPROVED", reason: "Looks fine." })).body.error.code).toBe("CRITICAL_FLAG");
    expect((await publish(id, { decision: "APPROVED", reason: "fine", override_critical_flag: true })).body.error.code).toBe("REASON_TOO_SHORT");

    const overridden = await publish(id, { decision: "APPROVED", reason: "Playful pillow fight; nobody is hurt.", override_critical_flag: true });
    expect(overridden.status).toBe(201);
    expect(overridden.body.decisions[0]).toMatchObject({ decision: "APPROVED", overrode_critical_flag: true });
    expect(overridden.body.content.content_score.score).toBe(88.8);
  });

  it("keeps families apart", async () => {
    const id = await importVideo("AAAAAAAAAAA");
    await publish(id, { decision: "APPROVED", reason: "Good." });
    const childId = await createChild(PARENT_A);
    expect((await request(app).get(`/children/${childId}`).set("Authorization", PARENT_B)).status).toBe(404);
    expect((await request(app).post(`/children/${childId}/library`).set("Authorization", PARENT_B).send({ content_item_id: id })).status).toBe(404);
  });

  it("holds a parent's submitted link until an admin approves it", async () => {
    const childId = await createChild(PARENT_A);
    apis.youtube.set("DDDDDDDDDDD", youtubeVideo("DDDDDDDDDDD"));
    apis.gemini.push(agentOutput());

    const submitted = await request(app)
      .post(`/children/${childId}/submissions`)
      .set("Authorization", PARENT_A)
      .send({ url: "https://www.youtube.com/watch?v=DDDDDDDDDDD" });
    expect(submitted.status).toBe(202);
    expect(submitted.body).toMatchObject({ status: "ACCEPTED", assessment: "PENDING" });
    await drainQueue();

    const [submission] = (await request(app).get(`/children/${childId}/submissions`).set("Authorization", PARENT_A)).body.items;
    expect(submission.assessment).toBe("SCORED");
    expect(submission.card.content_score.score).toBe(88.8);
    expect(submission.card.player).toBeNull();

    const contentId = submission.card.id as string;
    const kept = await request(app).post(`/children/${childId}/library`).set("Authorization", PARENT_A).send({ content_item_id: contentId });
    expect(kept.body).toMatchObject({ state: "REQUESTED", awaiting_review: true });
    const otherChild = await createChild(PARENT_B);
    expect((await request(app).post(`/children/${otherChild}/library`).set("Authorization", PARENT_B).send({ content_item_id: contentId })).status).toBe(404);

    const queue = await request(app).get("/review-queue").set("Authorization", ADMIN);
    expect(queue.body.items[0]).toMatchObject({ id: contentId, parent_requests: 1 });

    await publish(contentId, { decision: "APPROVED", reason: "Parent request reviewed." }).expect(201);
    const [item] = (await request(app).get(`/children/${childId}/library`).set("Authorization", PARENT_A)).body.items;
    expect(item).toMatchObject({ state: "ADDED", awaiting_review: false });
    expect(item.card.player).toMatchObject({ provider: "youtube" });
  });

  it("rejects onboarding keys that aren't in the shared taxonomy", async () => {
    const response = await request(app)
      .post("/children")
      .set("Authorization", PARENT_A)
      .send({ nickname: "Leo", birth_year: 2023, birth_month: 1, interests: ["dinosaurs"] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("UNKNOWN_TAXONOMY_KEY");
  });

  it("serves the OpenAPI contract", async () => {
    const response = await request(app).get("/openapi.json");
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining(["/content-items/{id}/publication-decisions", "/children/{id}/recommendations", "/ingestion-runs"]),
    );
  });
});
