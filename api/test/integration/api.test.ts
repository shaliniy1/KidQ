import "../fixtures/test-env";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { runMigrations } from "../../src/db/migrate";
import { closePool, getPool } from "../../src/db/pool";
import { createIngestionRun } from "../../src/services/ingestion";
import { drainQueue } from "../../src/services/worker";
import { agentOutput, fakeApis, installFakeApis, storyAgentOutput, storyweaverBook, youtubeVideo, type FakeApis } from "../fixtures/sources";

const app = createApp();
const pool = getPool();
const ADMIN = "Bearer dev:admin:11111111-1111-4111-8111-111111111111:admin@kidq.test";
const PARENT_A = "Bearer dev:parent:22222222-2222-4222-8222-222222222222";
const PARENT_B = "Bearer dev:parent:33333333-3333-4333-8333-333333333333";

let apis: FakeApis;

async function importVideo(id: string, gemini: string[] = [agentOutput()], title?: string) {
  apis.youtube.set(id, youtubeVideo(id, { title }));
  apis.gemini.push(...gemini);
  await createIngestionRun(pool, { sourceSystemId: "youtube", query: { mode: "urls", urls: [id] }, requestedBy: "test" });
  await drainQueue();
  return (await pool.query("SELECT content_item_id FROM source_records WHERE external_id = $1", [id])).rows[0].content_item_id as string;
}

async function createChild(auth: string, overrides: Record<string, unknown> = {}) {
  const response = await request(app)
    .post("/children")
    .set("Authorization", auth)
    .send({
      nickname: "Mia",
      age_band: "3_4",
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
  await pool.query("TRUNCATE ingestion_runs, content_items, outbox_events, ai_usage_daily, child_profiles, parent_profiles CASCADE");
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

  it("sends every item the AI hasn't reviewed with the current prompt to the AI once, skipping rejected items", async () => {
    await importVideo("AAAAAAAAAAA");
    const held = await importVideo("EEEEEEEEEEE", [agentOutput()], "Gentle shapes");
    const rejected = await importVideo("FFFFFFFFFFF", [agentOutput()], "Gentle shapes, part two");
    // Both were reviewed with an earlier prompt, so they're due for another look.
    await pool.query("UPDATE assessments SET prompt_version = '1' WHERE assessor_type = 'MODEL' AND content_item_id = ANY($1)", [[held, rejected]]);
    await publish(rejected, { decision: "REJECTED", reason: "Not for young children." }).expect(201);

    const scoreAll = () => request(app).post("/content-items/bulk-reanalyze").set("Authorization", ADMIN).send({ scope: "UNSCORED" });
    const first = await scoreAll();
    expect(first.status).toBe(202);
    expect(first.body).toEqual({ queued: 1 });
    expect((await scoreAll()).body).toEqual({ queued: 0 });

    const ai = async () => (await request(app).get("/dashboard").set("Authorization", ADMIN)).body.ai;
    expect(await ai()).toMatchObject({ enabled: true, scored: 1, queued: 1, unscored: 0, could_not_review: 0 });

    apis.gemini.push(agentOutput());
    await drainQueue();
    expect(await ai()).toMatchObject({ scored: 2, queued: 0, unscored: 0 });
    const reviews = (await pool.query("SELECT count(*)::int AS n FROM assessments WHERE content_item_id = $1 AND assessor_type = 'MODEL'", [held])).rows[0];
    expect(reviews.n).toBe(2);
  });

  it("shows a published item to parents of matching children, and to a child once their parent adds it", async () => {
    const counting = await importVideo("AAAAAAAAAAA"); // Maths, ages 2–4, English
    const forOlder = await importVideo("BBBBBBBBBBB", [agentOutput({ classification: { category: "maths", age_min: 4, age_max: 6 } })], "Counting to a hundred");
    const hindi = await importVideo("HHHHHHHHHHH", [agentOutput({ classification: { language: "hi" } })], "Ginti gaana");
    const song = await importVideo("GGGGGGGGGGG", [agentOutput({ classification: { category: "music_rhymes" } })], "Slow lullaby");
    await importVideo("UUUUUUUUUUU", [agentOutput()], "Counting to three"); // never published
    for (const id of [counting, forOlder, hindi, song]) await publish(id, { decision: "APPROVED", reason: "Calm and clear." }).expect(201);

    const ids = async (childId: string) =>
      (await request(app).get(`/children/${childId}/recommendations`).set("Authorization", PARENT_A)).body.items.map((item: { card: { id: string } }) => item.card.id);
    // A 3–4 child (age 3.5) who reads English: not the 4–6 video, the Hindi one or the unpublished one.
    const surprise = await createChild(PARENT_A);
    expect((await ids(surprise)).sort()).toEqual([counting, song].sort());
    // "Let me choose: Maths" narrows it to Maths.
    const mathsOnly = await createChild(PARENT_A, { content_mix: "CHOSEN", preferred_categories: ["maths"] });
    expect(await ids(mathsOnly)).toEqual([counting]);

    const pool = (await request(app).get("/content-pool").set("Authorization", ADMIN)).body;
    expect(pool).toMatchObject({ published: 4, eligible: 4, not_reaching_parents: [] });
    const band = pool.bands.find((b: { age_band: string }) => b.age_band === "3_4");
    expect(band.categories.find((c: { category: string }) => c.category === "maths")).toEqual({ category: "maths", count: 2, thin: true });

    // The child sees nothing until the parent adds it; then it plays; unpublishing takes it away again.
    const library = async () => (await request(app).get(`/children/${mathsOnly}/library`).set("Authorization", PARENT_A)).body.items;
    expect(await library()).toEqual([]);
    await request(app).post(`/children/${mathsOnly}/library`).set("Authorization", PARENT_A).send({ content_item_id: counting });
    expect((await library())[0].card.player).toMatchObject({ provider: "youtube", video_id: "AAAAAAAAAAA" });
    await publish(counting, { decision: "MANUAL_REVIEW_REQUIRED", reason: "Another look." }).expect(201);
    expect(await library()).toEqual([]);
    expect(await ids(mathsOnly)).toEqual([]);
  });

  it("starts a session from the child's library only, logs how it went, and keeps families apart", async () => {
    const counting = await importVideo("AAAAAAAAAAA");
    const song = await importVideo("GGGGGGGGGGG", [agentOutput({ classification: { category: "music_rhymes" } })], "Slow lullaby");
    const notAdded = await importVideo("BBBBBBBBBBB", [agentOutput()], "Counting to ten");
    for (const id of [counting, song, notAdded]) await publish(id, { decision: "APPROVED", reason: "Calm and clear." }).expect(201);
    const childId = await createChild(PARENT_A);
    for (const id of [counting, song]) await request(app).post(`/children/${childId}/library`).set("Authorization", PARENT_A).send({ content_item_id: id });

    const started = await request(app).post(`/children/${childId}/sessions`).set("Authorization", PARENT_A).send({ minutes: 45 });
    expect(started.status).toBe(201);
    const session = started.body;
    const queued = session.slots.flatMap((slot: { items: Array<{ card: { id: string } }> }) => slot.items.map((item) => item.card.id));
    // Two 3:20 videos fill one slot: only what the parent added, and the session ends on the wind-down.
    expect(queued.sort()).toEqual([counting, song].sort());
    expect(session.slots.map((slot: { break_after: string }) => slot.break_after)).toEqual(["WIND_DOWN"]);
    expect(session.short_by_minutes).toBe(38);
    expect((await request(app).get(`/children/${childId}`).set("Authorization", PARENT_A)).body.session_minutes).toBe(45);

    const first = session.slots[0].items[0];
    const watched = await request(app).patch(`/sessions/${session.id}/items/${first.id}`).set("Authorization", PARENT_A).send({ outcome: "COMPLETED", watched_seconds: 200 });
    expect(watched.body.slots[0].items[0]).toMatchObject({ outcome: "COMPLETED", watched_seconds: 200 });
    expect((await request(app).post(`/sessions/${session.id}/end`).set("Authorization", PARENT_A).send({ outcome: "EXITED" })).body.outcome).toBe("EXITED");
    expect((await request(app).post(`/sessions/${session.id}/end`).set("Authorization", PARENT_A).send({ outcome: "COMPLETED" })).status).toBe(409);

    const log = (await request(app).get(`/children/${childId}/sessions`).set("Authorization", PARENT_A)).body.items;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ id: session.id, minutes: 45, outcome: "EXITED" });

    expect((await request(app).get(`/children/${childId}/sessions`).set("Authorization", PARENT_B)).status).toBe(404);
    expect((await request(app).patch(`/sessions/${session.id}/items/${first.id}`).set("Authorization", PARENT_B).send({ outcome: "SKIPPED" })).status).toBe(404);
  });

  it("records viewing once, caps screen time, and shows it only to the child's parent", async () => {
    const videoId = await importVideo("AAAAAAAAAAA");
    await publish(videoId, { decision: "APPROVED", reason: "Calm and clear." }).expect(201);
    await request(app)
      .post("/onboarding")
      .set("Authorization", PARENT_A)
      .send({ parent_name: "Asha", timezone: "Asia/Kolkata", children: [{ nickname: "Mia", age_band: "3_4" }] })
      .expect(201);
    const me = (await request(app).get("/me").set("Authorization", PARENT_A)).body;
    expect(me.parent.timezone).toBe("Asia/Kolkata");
    const childId = me.children[0].id as string;

    const t0 = Date.now() - 10 * 60 * 1000;
    const at = (seconds: number) => new Date(t0 + seconds * 1000).toISOString();
    const [first, second] = [crypto.randomUUID(), crypto.randomUUID()];
    const progress = { event_name: "video_progress", client_event_id: crypto.randomUUID(), occurred_at: at(100), content_id: videoId, play_id: first, position_seconds: 100, progress_percent: 50, active_seconds: 100 };
    const send = (events: unknown[], auth = PARENT_A) => request(app).post(`/children/${childId}/events`).set("Authorization", auth).send({ events });

    expect(
      (
        await send([
          { event_name: "video_started", client_event_id: crypto.randomUUID(), occurred_at: at(0), content_id: videoId, play_id: first, recommendation_source: "PARENT_PLAYLIST" },
          progress,
          { event_name: "video_completed", client_event_id: crypto.randomUUID(), occurred_at: at(185), content_id: videoId, play_id: first, position_seconds: 185, progress_percent: 92, active_seconds: 85 },
        ])
      ).body,
    ).toEqual({ accepted: 3, duplicates: 0, ignored: 0 });
    // A resent event, then a replay whose app claims 500 s in the 10 s since it started.
    expect(
      (
        await send([
          progress,
          { event_name: "video_started", client_event_id: crypto.randomUUID(), occurred_at: at(200), content_id: videoId, play_id: second },
          { event_name: "video_exited", client_event_id: crypto.randomUUID(), occurred_at: at(210), content_id: videoId, play_id: second, position_seconds: 10, progress_percent: 5, active_seconds: 500 },
        ])
      ).body,
    ).toEqual({ accepted: 2, duplicates: 1, ignored: 0 });

    const page = (await request(app).get(`/children/${childId}/analytics?period=7d`).set("Authorization", PARENT_A).expect(200)).body;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(t0));
    // 100 + 85 counted for the first play; the replay's 500 s is capped to 10 s + 5 s slack.
    expect(page.overview).toMatchObject({ screen_minutes: 3, videos_watched: 1 });
    expect(page.daily.find((entry: { date: string }) => entry.date === day).minutes).toBe(3);
    expect(page.completion).toEqual({ started: 2, completed: 1, partly_watched: 0, stopped_early: 1 });
    expect(page.top_content[0]).toMatchObject({ card: { id: videoId, player: null }, times_watched: 2 });
    expect(page.timezone).toBe("Asia/Kolkata");

    expect((await request(app).get(`/children/${childId}/analytics`).set("Authorization", PARENT_B)).status).toBe(404);
    expect((await send([progress], PARENT_B)).status).toBe(404);
  });

  it("lets parents choose the seven categories, and shapes a session by mode and lean-toward", async () => {
    const counting = await importVideo("AAAAAAAAAAA");
    const nature = await importVideo("BBBBBBBBBBB", [agentOutput({ classification: { category: "science", session_modes: ["BEDTIME"] } })], "Sleepy forest animals");
    for (const id of [counting, nature]) await publish(id, { decision: "APPROVED", reason: "Calm and clear." }).expect(201);

    const childId = await createChild(PARENT_A, { content_mix: "CHOSEN", preferred_categories: ["our_world"] });
    const recommended = (await request(app).get(`/children/${childId}/recommendations`).set("Authorization", PARENT_A)).body.items;
    expect(recommended.map((item: { card: { id: string } }) => item.card.id)).toEqual([nature]);
    expect(recommended[0].card).toMatchObject({ parent_category: "our_world", session_modes: ["BEDTIME"], kidq_check: { status: "REVIEWED" } });
    expect(recommended[0].card.kidq_check.dimensions[0]).toEqual({ key: "CONTENT_LANGUAGE", label: expect.any(String), summary: expect.any(String) });

    for (const id of [counting, nature]) await request(app).post(`/children/${childId}/library`).set("Authorization", PARENT_A).send({ content_item_id: id });
    const start = (body: Record<string, unknown>) => request(app).post(`/children/${childId}/sessions`).set("Authorization", PARENT_A).send(body);
    expect((await start({ minutes: 15, lean_toward: "animation" })).status).toBe(400);
    const session = (await start({ minutes: 15, mode: "BEDTIME", lean_toward: "numbers_thinking" })).body;
    expect(session).toMatchObject({ mode: "BEDTIME", opener: { band: "NIGHT" }, wind_down: "SLEEP", lean_toward: "numbers_thinking" });
    // The parent's lean-toward outranks the Bedtime tag; both videos are calm enough for bedtime.
    expect(session.slots[0].items.map((item: { card: { id: string } }) => item.card.id)).toEqual([counting, nature]);

    const child = (await request(app).get(`/children/${childId}`).set("Authorization", PARENT_A)).body;
    expect(child).toMatchObject({ session_mode: "BEDTIME", break_interval_minutes: 15 });
    expect(child).not.toHaveProperty("lean_toward");
    const patched = (await request(app).patch(`/children/${childId}`).set("Authorization", PARENT_A).send({ break_interval_minutes: 10, session_minutes: 30 })).body;
    expect(patched.break_plan.total_breaks).toBe(3);
  });

  it("previews a YouTube link for the parent without saving it", async () => {
    const childId = await createChild(PARENT_A);
    apis.youtube.set("PPPPPPPPPPP", youtubeVideo("PPPPPPPPPPP", { title: "Counting to ten with numbers" }));
    const preview = await request(app)
      .post(`/children/${childId}/submissions/preview`)
      .set("Authorization", PARENT_A)
      .send({ url: "https://www.youtube.com/watch?v=PPPPPPPPPPP" });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({
      video_id: "PPPPPPPPPPP",
      already_in_kidq: false,
      title: "Counting to ten with numbers",
      category: "maths",
      parent_category: "numbers_thinking",
      kidq_check: { status: "NOT_CHECKED", dimensions: [] },
    });
    expect((await pool.query("SELECT count(*)::int AS n FROM source_records WHERE external_id = 'PPPPPPPPPPP'")).rows[0].n).toBe(0);
    expect((await request(app).post(`/children/${childId}/submissions/preview`).set("Authorization", PARENT_B).send({ url: "https://youtu.be/PPPPPPPPPPP" })).status).toBe(404);
  });

  it("gives a child with only an age a mixed feed", async () => {
    const counting = await importVideo("AAAAAAAAAAA");
    const moreCounting = await importVideo("BBBBBBBBBBB", [agentOutput()], "Counting to ten");
    // A slightly lower score, so the two counting videos lead and variety has to split them.
    const song = await importVideo("GGGGGGGGGGG", [agentOutput({ scores: [90, 78, 89, 87], classification: { category: "music_rhymes" } })], "Slow lullaby");
    for (const id of [counting, moreCounting, song]) await publish(id, { decision: "APPROVED", reason: "Calm and clear." }).expect(201);

    // Screen 1 only: a nickname and an age band, nothing else.
    const onboarded = await request(app).post("/onboarding").set("Authorization", PARENT_A).send({ parent_name: "Priya", children: [{ nickname: "Mia", age_band: "3_4" }] });
    expect(onboarded.status).toBe(201);
    const feed = (await request(app).get(`/children/${onboarded.body.children[0].id}/recommendations`).set("Authorization", PARENT_A)).body.items;
    expect(feed.map((item: { card: { category: string } }) => item.card.category)).toEqual(["maths", "music_rhymes", "maths"]);

    const [first] = feed;
    expect(first.card.learning).toEqual({ value: 25, areas: ["Thinking"] });
    expect(first.card.categories).toEqual(["maths"]);
    expect(first.card).not.toHaveProperty("expert_review");
  });

  it("serves a picture book's pages to admins, and to parents only once it's published", async () => {
    const book = storyweaverBook(9101);
    apis.storyweaver.hits.push(book.hit);
    apis.storyweaver.reads.set(book.hit.slug, book.pages);
    apis.gemini.push(storyAgentOutput());
    await createIngestionRun(pool, { sourceSystemId: "storyweaver", query: { mode: "search", queries: [{ query: "rain", maxResults: 5 }] }, requestedBy: "test" });
    await drainQueue();
    const id = (await pool.query("SELECT id FROM content_items WHERE content_type = 'STORYBOOK'")).rows[0].id as string;

    const detail = (await request(app).get(`/content-items/${id}`).set("Authorization", ADMIN)).body;
    expect(detail.content.player).toEqual({ provider: "story", page_count: 2 });
    expect(detail.story.pages).toHaveLength(2);
    expect(detail.content.content_score.breakdown.map((part: { key: string }) => part.key)).toEqual(["CONTENT_LANGUAGE", "PACING", "VISUAL_COMFORT"]);

    const story = () => request(app).get(`/content-items/${id}/story`).set("Authorization", PARENT_A);
    expect((await story()).status).toBe(404);
    await publish(id, { decision: "APPROVED", reason: "Gentle rainy-day story." }).expect(201);
    const published = await story();
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ title: "A Rainy Day", attribution: { license_name: "CC BY 4.0" } });
    expect(published.body.credits).toContain("Released under CC BY 4.0 license");
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
    const response = await request(app).post("/children").set("Authorization", PARENT_A).send({ nickname: "Leo", age_band: "2_3", interests: ["dinosaurs"] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("UNKNOWN_TAXONOMY_KEY");
  });

  it("onboards a family in one call and fills in the rest from each child's age", async () => {
    expect((await request(app).get("/me").set("Authorization", PARENT_A)).body.error.code).toBe("NOT_ONBOARDED");
    const onboarded = await request(app)
      .post("/onboarding")
      .set("Authorization", PARENT_A)
      .send({ parent_name: "Asha", language: "hi", children: [{ nickname: "Mia", age_band: "0_2" }, { nickname: "Leo", age_band: "4_5" }] });
    expect(onboarded.status).toBe(201);
    expect(onboarded.body.parent).toMatchObject({ name: "Asha", language: "hi" });
    const [mia, leo] = onboarded.body.children;
    expect(mia).toMatchObject({
      nickname: "Mia",
      age_band: "0_2",
      age_years: 1,
      languages: ["hi"],
      interests: [],
      content_mix: "SURPRISE",
      development_goals: ["motor_skills", "communication", "emotional"],
      development_goals_source: "AGE_DEFAULT",
      regulation_goals: [],
      session_minutes: 15,
      break_type: "ALTERNATE",
      break_plan: { total_breaks: 1, mid_session_breaks: 0, wind_down: true },
    });
    expect(leo).toMatchObject({ age_band: "4_5", session_minutes: 30, development_goals: ["cognitive", "creativity", "problem_solving"] });

    // "Customize for Leo": every optional block at once. All six regulation goals mean no restriction.
    const customized = await request(app)
      .patch(`/children/${leo.id}`)
      .set("Authorization", PARENT_A)
      .send({
        interests: ["space"],
        content_mix: "CHOSEN",
        preferred_categories: ["science"],
        regulation_goals: ["calm", "emotional_regulation", "focus", "movement", "relaxation", "social_regulation"],
        session_minutes: 45,
        break_type: "QUIET",
      });
    expect(customized.body).toMatchObject({
      content_mix: "CHOSEN",
      preferred_categories: ["science"],
      regulation_goals: [],
      session_minutes: 45,
      break_type: "QUIET",
      break_plan: { total_breaks: 3, mid_session_breaks: 2, wind_down: true },
    });
    const noCategories = await request(app).patch(`/children/${leo.id}`).set("Authorization", PARENT_A).send({ content_mix: "CHOSEN", preferred_categories: [] });
    expect(noCategories.body.error.code).toBe("CATEGORIES_REQUIRED");

    const me = await request(app).get("/me").set("Authorization", PARENT_A);
    expect(me.body.children.map((child: { nickname: string }) => child.nickname)).toEqual(["Mia", "Leo"]);
    const tooMany = await request(app)
      .post("/onboarding")
      .set("Authorization", PARENT_A)
      .send({ parent_name: "Asha", language: "hi", children: Array.from({ length: 5 }, (_, index) => ({ nickname: `Kid ${index}`, age_band: "2_3" })) });
    expect(tooMany.status).toBe(422);
    expect(tooMany.body.error.code).toBe("TOO_MANY_CHILDREN");
  });

  it("shares one vocabulary between onboarding and admin tagging", async () => {
    const taxonomy = (await request(app).get("/taxonomy")).body;
    expect(taxonomy.age_group.map((term: { key: string }) => term.key)).toEqual(["0_2", "2_3", "3_4", "4_5", "5_6"]);
    // Parents choose from seven groups; Animation is a style, not a category (spec v5, Block B).
    expect(taxonomy.parent_category.map((term: { label: string }) => term.label)).toEqual([
      "Stories & Rhymes",
      "Songs & Music",
      "Numbers & Thinking",
      "Our World",
      "Art & Making",
      "Move & Play",
      "Calm & Breathe",
    ]);
    expect(taxonomy.category.map((term: { label: string }) => term.label)).toEqual([
      "Stories",
      "Storybooks",
      "Crafts",
      "Painting",
      "Science",
      "Maths",
      "Yoga",
      "Activities",
      "Educational",
      "Music / Rhymes",
      "Knowledge / General Learning",
    ]);
    expect(taxonomy.regulation_goal.find((term: { key: string }) => term.key === "calm").meta.parent_label).toBe("Help them calm down");
  });

  it("serves the OpenAPI contract", async () => {
    const response = await request(app).get("/openapi.json");
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining(["/content-items/{id}/publication-decisions", "/children/{id}/recommendations", "/ingestion-runs"]),
    );
  });
});
