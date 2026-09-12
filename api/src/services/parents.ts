// Parent side: onboarding (parent and child profiles), recommendations, the parent-approved library
// and URL submissions. Every query is scoped to the signed-in parent; unapproved content is
// invisible except a parent's own submissions, which wait for admin approval.
import { fetchYouTubeVideos, parseYouTubeId } from "../connectors/youtube";
import { getPool, withTransaction, type Db } from "../db/pool";
import { ageFromBand, bandForAge, type AgeBand } from "../domain/age";
import {
  breakPlan,
  DEFAULT_DEVELOPMENT_GOALS,
  defaultSessionMinutes,
  MAX_CHILDREN,
  type BreakType,
  type ContentMix,
  type SessionMinutes,
} from "../domain/onboarding";
import { recommend, type CandidateInput, type ChildProfileInput } from "../domain/recommendation";
import type { AuthUser } from "../http/auth";
import { ApiError, notFound } from "../http/errors";
import type { ChildBody, ChildPatchBody, MePatchBody, OnboardingBody, PreviewBody } from "../http/schemas";
import { getActiveRankingConfig } from "../repositories/config";
import { getCardRows, listApprovedCardRows, toCard, type ContentCard } from "../repositories/content";
import { keysOf, listTaxonomy, type Taxonomy, type TaxonomyKind } from "../repositories/taxonomy";
import { upsertRecord } from "./ingestion";

const SUBMISSIONS_PER_DAY = 20;
const PARENT_PRIORITY = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const toIso = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value));
/** A local calendar date; Postgres `date` values arrive as local midnight. */
const dateOnly = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const notOnboarded = () => new ApiError(404, "NOT_ONBOARDED", "No parent profile yet: start with POST /onboarding.");

// ── Parent and child profiles ─────────────────────────────────────────────────
interface ChildColumns {
  nickname: string;
  age_band: AgeBand;
  age_band_set_on: string;
  languages: string[];
  interests: string[];
  content_mix: ContentMix;
  preferred_categories: string[];
  development_goals: string[];
  development_goals_custom: boolean;
  regulation_goals: string[];
  session_minutes: number;
  break_type: BreakType;
}

const CHILD_COLUMNS = [
  "nickname",
  "age_band",
  "age_band_set_on",
  "languages",
  "interests",
  "content_mix",
  "preferred_categories",
  "development_goals",
  "development_goals_custom",
  "regulation_goals",
  "session_minutes",
  "break_type",
] as const;

function toChild(row: Row) {
  const ageYears = ageFromBand(row.age_band, new Date(row.age_band_set_on));
  const band = bandForAge(ageYears);
  const custom = row.development_goals_custom === true;
  return {
    id: row.id as string,
    nickname: row.nickname as string,
    age_band: band,
    age_years: ageYears,
    languages: row.languages as string[],
    interests: row.interests as string[],
    content_mix: row.content_mix as ContentMix,
    preferred_categories: row.preferred_categories as string[],
    // Block C is never asked: the goals follow the child's age unless someone set them on purpose.
    development_goals: custom ? (row.development_goals as string[]) : DEFAULT_DEVELOPMENT_GOALS[band],
    development_goals_source: custom ? ("PARENT" as const) : ("AGE_DEFAULT" as const),
    regulation_goals: row.regulation_goals as string[],
    session_minutes: row.session_minutes as SessionMinutes,
    break_type: row.break_type as BreakType,
    break_plan: breakPlan(row.session_minutes),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}
type Child = ReturnType<typeof toChild>;

function toParent(row: Row) {
  return { name: row.name as string, language: row.language as string, created_at: toIso(row.created_at), updated_at: toIso(row.updated_at) };
}

function columnsOf(row: Row): ChildColumns {
  return {
    nickname: row.nickname,
    age_band: row.age_band,
    age_band_set_on: row.age_band_set_on instanceof Date ? dateOnly(row.age_band_set_on) : String(row.age_band_set_on),
    languages: row.languages,
    interests: row.interests,
    content_mix: row.content_mix,
    preferred_categories: row.preferred_categories,
    development_goals: row.development_goals,
    development_goals_custom: row.development_goals_custom,
    regulation_goals: row.regulation_goals,
    session_minutes: row.session_minutes,
    break_type: row.break_type,
  };
}

/** A new child: only the nickname and age band come from the parent; the rest follows from age. */
function newChild(nickname: string, band: AgeBand, language: string): ChildColumns {
  return {
    nickname,
    age_band: band,
    age_band_set_on: dateOnly(new Date()),
    languages: [language],
    interests: [],
    content_mix: "SURPRISE",
    preferred_categories: [],
    development_goals: [],
    development_goals_custom: false,
    regulation_goals: [],
    session_minutes: defaultSessionMinutes(band),
    break_type: "ALTERNATE",
  };
}

/** Every key comes from the shared vocabulary (GET /taxonomy), the one admins tag content with. */
function assertKnownKeys(taxonomy: Taxonomy, values: Partial<Record<"languages" | "interests" | "preferred_categories" | "development_goals" | "regulation_goals", string[]>>) {
  const check = (kind: TaxonomyKind, field: keyof typeof values) => {
    const unknown = (values[field] ?? []).filter((value) => !keysOf(taxonomy, kind).includes(value));
    if (unknown.length) throw new ApiError(400, "UNKNOWN_TAXONOMY_KEY", `Unknown ${field}: ${unknown.join(", ")}. Use keys from GET /taxonomy.`, { field, unknown });
  };
  check("language", "languages");
  check("interest", "interests");
  check("category", "preferred_categories");
  check("development_goal", "development_goals");
  check("regulation_goal", "regulation_goals");
}

const unique = (values: string[]) => [...new Set(values)];

/** Applies a request on top of the current values (or a new child's defaults). */
function applyChange(current: ChildColumns, change: ChildPatchBody, taxonomy: Taxonomy): ChildColumns {
  const next: ChildColumns = { ...current };
  if (change.nickname !== undefined) next.nickname = change.nickname;
  if (change.age_band !== undefined) {
    next.age_band = change.age_band;
    next.age_band_set_on = dateOnly(new Date());
  }
  if (change.languages !== undefined) next.languages = unique(change.languages);
  if (change.interests !== undefined) next.interests = unique(change.interests);
  if (change.preferred_categories !== undefined) {
    next.preferred_categories = unique(change.preferred_categories);
    if (change.content_mix === undefined && next.preferred_categories.length > 0) next.content_mix = "CHOSEN";
  }
  if (change.content_mix !== undefined) next.content_mix = change.content_mix;
  if (next.content_mix === "SURPRISE") next.preferred_categories = [];
  if (next.content_mix === "CHOSEN" && next.preferred_categories.length === 0) {
    throw new ApiError(400, "CATEGORIES_REQUIRED", "Choose at least one category, or pick “Surprise us”.");
  }
  if (change.development_goals !== undefined) {
    next.development_goals = unique(change.development_goals);
    next.development_goals_custom = next.development_goals.length > 0;
  }
  if (change.regulation_goals !== undefined) {
    // "All six" and "none" both mean no restriction (the Block D default).
    const all = keysOf(taxonomy, "regulation_goal");
    next.regulation_goals = all.every((key) => change.regulation_goals?.includes(key)) ? [] : unique(change.regulation_goals);
  }
  if (change.session_minutes !== undefined) next.session_minutes = change.session_minutes;
  if (change.break_type !== undefined) next.break_type = change.break_type;
  return next;
}

async function insertChild(db: Db, parentUserId: string, child: ChildColumns): Promise<Row> {
  const placeholders = CHILD_COLUMNS.map((_, index) => `$${index + 2}`).join(", ");
  // clock_timestamp keeps the order children were entered in, even inside one onboarding transaction.
  const { rows } = await db.query(
    `INSERT INTO child_profiles (parent_user_id, ${CHILD_COLUMNS.join(", ")}, created_at) VALUES ($1, ${placeholders}, clock_timestamp()) RETURNING *`,
    [parentUserId, ...CHILD_COLUMNS.map((column) => child[column])],
  );
  return rows[0];
}

async function assertRoomFor(db: Db, parentUserId: string, adding: number) {
  const { rows } = await db.query("SELECT count(*)::int AS n FROM child_profiles WHERE parent_user_id = $1", [parentUserId]);
  if (rows[0].n + adding > MAX_CHILDREN) {
    throw new ApiError(422, "TOO_MANY_CHILDREN", `A family can have up to ${MAX_CHILDREN} child profiles.`, { existing: rows[0].n, adding });
  }
}

async function childRow(user: AuthUser, childId: string): Promise<Row> {
  const row = (await getPool().query("SELECT * FROM child_profiles WHERE id = $1 AND parent_user_id = $2", [childId, user.id])).rows[0];
  // Another family's child looks exactly like a missing one.
  if (!row) throw notFound("Child");
  return row;
}

async function childRows(db: Db, user: AuthUser): Promise<Row[]> {
  return (await db.query("SELECT * FROM child_profiles WHERE parent_user_id = $1 ORDER BY created_at, id", [user.id])).rows;
}

/** Screen 1 in one call: the parent's name and language, and each child's nickname and age band. */
export async function onboard(user: AuthUser, body: OnboardingBody) {
  assertKnownKeys(await listTaxonomy(getPool()), { languages: [body.language] });
  return withTransaction(async (client) => {
    const parent = (
      await client.query(
        `INSERT INTO parent_profiles (parent_user_id, name, language) VALUES ($1, $2, $3)
         ON CONFLICT (parent_user_id) DO UPDATE SET name = EXCLUDED.name, language = EXCLUDED.language, updated_at = now()
         RETURNING *`,
        [user.id, body.parent_name, body.language],
      )
    ).rows[0];
    await assertRoomFor(client, user.id, body.children.length);
    for (const child of body.children) await insertChild(client, user.id, newChild(child.nickname, child.age_band, body.language));
    return { parent: toParent(parent), children: (await childRows(client, user)).map(toChild) };
  });
}

export async function getMe(user: AuthUser) {
  const db = getPool();
  const parent = (await db.query("SELECT * FROM parent_profiles WHERE parent_user_id = $1", [user.id])).rows[0];
  if (!parent) throw notOnboarded();
  return { parent: toParent(parent), children: (await childRows(db, user)).map(toChild) };
}

export async function updateMe(user: AuthUser, patch: MePatchBody) {
  const db = getPool();
  if (patch.language) assertKnownKeys(await listTaxonomy(db), { languages: [patch.language] });
  const { rowCount } = await db.query(
    "UPDATE parent_profiles SET name = COALESCE($2, name), language = COALESCE($3, language), updated_at = now() WHERE parent_user_id = $1",
    [user.id, patch.name ?? null, patch.language ?? null],
  );
  if (!rowCount) throw notOnboarded();
  return getMe(user);
}

export async function listChildren(user: AuthUser) {
  return { items: (await childRows(getPool(), user)).map(toChild) };
}

export async function getChild(user: AuthUser, childId: string) {
  return toChild(await childRow(user, childId));
}

/** Adds a child after onboarding; they start with the parent's language. */
export async function createChild(user: AuthUser, body: ChildBody) {
  const db = getPool();
  const taxonomy = await listTaxonomy(db);
  assertKnownKeys(taxonomy, body);
  await assertRoomFor(db, user.id, 1);
  const language = (await db.query("SELECT language FROM parent_profiles WHERE parent_user_id = $1", [user.id])).rows[0]?.language ?? "en";
  return toChild(await insertChild(db, user.id, applyChange(newChild(body.nickname, body.age_band, language), body, taxonomy)));
}

/** "Customize for {child}": any of the optional blocks, the language or a new age band. */
export async function updateChild(user: AuthUser, childId: string, patch: ChildPatchBody) {
  const current = await childRow(user, childId);
  const db = getPool();
  const taxonomy = await listTaxonomy(db);
  assertKnownKeys(taxonomy, patch);
  const next = applyChange(columnsOf(current), patch, taxonomy);
  const sets = CHILD_COLUMNS.map((column, index) => `${column} = $${index + 3}`).join(", ");
  const { rows } = await db.query(`UPDATE child_profiles SET ${sets}, updated_at = now() WHERE id = $1 AND parent_user_id = $2 RETURNING *`, [
    childId,
    user.id,
    ...CHILD_COLUMNS.map((column) => next[column]),
  ]);
  return toChild(rows[0]);
}

// ── Recommendations ───────────────────────────────────────────────────────────
function toCandidate(row: Row): CandidateInput {
  return {
    id: row.id,
    approved: row.current_status === "APPROVED",
    playable: row.available !== false && row.embeddable !== false && row.allows_embedding === true,
    blocked: row.has_critical_flag,
    contentType: row.content_type,
    language: row.language,
    ageMin: toNumber(row.age_min),
    ageMax: toNumber(row.age_max),
    category: row.category,
    interests: row.interests ?? [],
    developmentGoals: row.development_goals ?? [],
    regulationGoals: row.regulation_goals ?? [],
    durationSeconds: row.duration_seconds,
    creator: row.channel_or_creator,
    kidqScore: toNumber(row.kidq_score),
    expert: row.expert_total > 0 ? { recommend: row.expert_recommend, total: row.expert_total } : null,
  };
}

function friendlyWhy(taxonomy: Taxonomy, card: ContentCard, ranked: ReturnType<typeof recommend>[number], ageYears: number): string[] {
  const label = (kind: TaxonomyKind, key: string) => taxonomy[kind].find((term) => term.key === key)?.label ?? key;
  const list = (kind: TaxonomyKind, keys: string[]) => keys.map((key) => label(kind, key)).join(", ");
  const why: string[] = [];
  if (ranked.coldStart) why.push(`A top-rated pick for age ${Math.floor(ageYears)}`);
  if (ranked.matched.interests.length) why.push(`Matches interests: ${list("interest", ranked.matched.interests)}`);
  if (ranked.matched.developmentGoals.length) why.push(`Supports: ${list("development_goal", ranked.matched.developmentGoals)}`);
  if (ranked.matched.regulationGoals.length) why.push(`Helps with: ${list("regulation_goal", ranked.matched.regulationGoals)}`);
  if (ranked.matched.category && card.category) why.push(`Favourite category: ${label("category", card.category)}`);
  return why;
}

async function rankFor(db: Db, profile: ChildProfileInput, excluded: Set<string>, limit: number, offset: number) {
  const [config, rows, taxonomy] = await Promise.all([getActiveRankingConfig(db), listApprovedCardRows(db), listTaxonomy(db)]);
  const byId = new Map(rows.map((row) => [row.id as string, row]));
  const ranked = recommend(profile, rows.map(toCandidate), config, excluded, { limit, offset });
  return {
    items: ranked.map((item) => {
      const card = toCard(byId.get(item.contentId) as Row);
      return { rank: item.rank, final_score: item.finalScore, relevance: item.relevance, cold_start: item.coldStart, why: friendlyWhy(taxonomy, card, item, profile.ageYears), card };
    }),
    limit,
    offset,
    ranking_version: config.version,
  };
}

function profileOf(child: Pick<Child, "age_years" | "languages" | "interests" | "development_goals" | "regulation_goals" | "content_mix" | "preferred_categories"> & { session_minutes: number }): ChildProfileInput {
  return {
    ageYears: child.age_years,
    languages: child.languages,
    interests: child.interests,
    developmentGoals: child.development_goals,
    regulationGoals: child.regulation_goals,
    contentMix: child.content_mix,
    preferredCategories: child.preferred_categories,
    sessionMinutes: child.session_minutes,
  };
}

export async function recommendationsFor(user: AuthUser, childId: string, paging: { limit: number; offset: number }) {
  const child = toChild(await childRow(user, childId));
  const db = getPool();
  const config = await getActiveRankingConfig(db);
  const excluded = new Set(
    (
      await db.query(
        `SELECT content_item_id FROM library_items WHERE child_profile_id = $1
           AND (state IN ('ADDED', 'REQUESTED') OR updated_at > now() - make_interval(days => $2))`,
        [childId, config.params.dismissCooldownDays],
      )
    ).rows.map((row) => row.content_item_id as string),
  );
  return rankFor(db, profileOf(child), excluded, paging.limit, paging.offset);
}

/** Admin preview: what a child with this profile would see right now. */
export async function previewRecommendations(body: PreviewBody) {
  const db = getPool();
  const taxonomy = await listTaxonomy(db);
  assertKnownKeys(taxonomy, body);
  const child = applyChange(newChild("Preview", body.age_band, body.languages?.[0] ?? "en"), body, taxonomy);
  const developmentGoals = child.development_goals_custom ? child.development_goals : DEFAULT_DEVELOPMENT_GOALS[child.age_band];
  const profile = profileOf({ ...child, age_years: ageFromBand(child.age_band, new Date()), development_goals: developmentGoals });
  return rankFor(db, profile, new Set(), body.limit, 0);
}

// ── Parent-approved library ───────────────────────────────────────────────────
async function ownsSubmission(db: Db, user: AuthUser, contentItemId: string) {
  const { rowCount } = await db.query("SELECT 1 FROM content_submissions WHERE parent_user_id = $1 AND content_item_id = $2 LIMIT 1", [user.id, contentItemId]);
  return (rowCount ?? 0) > 0;
}

export async function getLibrary(user: AuthUser, childId: string) {
  await childRow(user, childId);
  const db = getPool();
  const { rows } = await db.query(
    "SELECT content_item_id, state, updated_at FROM library_items WHERE child_profile_id = $1 AND state IN ('ADDED', 'REQUESTED') ORDER BY updated_at DESC",
    [childId],
  );
  const cards = await getCardRows(db, rows.map((row) => row.content_item_id), { approvedOnly: false });
  return {
    items: rows.flatMap((row) => {
      const cardRow = cards.get(row.content_item_id);
      if (!cardRow) return [];
      const approved = cardRow.current_status === "APPROVED";
      // Unpublished content disappears from every library immediately.
      if (row.state === "ADDED" && !approved) return [];
      const awaiting = row.state === "REQUESTED";
      const card = toCard(cardRow);
      return [{ state: row.state, awaiting_review: awaiting, updated_at: toIso(row.updated_at), card: awaiting ? { ...card, player: null } : card }];
    }),
  };
}

export async function setLibraryState(user: AuthUser, childId: string, contentItemId: string, requested: "ADDED" | "DISMISSED") {
  await childRow(user, childId);
  const db = getPool();
  const item = (await db.query("SELECT current_status FROM content_items WHERE id = $1", [contentItemId])).rows[0];
  const approved = item?.current_status === "APPROVED";
  if (!item || (!approved && !(await ownsSubmission(db, user, contentItemId)))) throw notFound("Content item");
  // A parent's own unapproved submission waits for an admin before the child can see it.
  const state = requested === "ADDED" && !approved ? "REQUESTED" : requested;
  await db.query(
    `INSERT INTO library_items (child_profile_id, content_item_id, state) VALUES ($1, $2, $3)
     ON CONFLICT (child_profile_id, content_item_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [childId, contentItemId, state],
  );
  if (state === "REQUESTED") {
    await db.query("UPDATE outbox_events SET priority = GREATEST(priority, $2) WHERE dedupe_key = $1 AND status = 'PENDING'", [
      `analyze:${contentItemId}`,
      PARENT_PRIORITY,
    ]);
  }
  return { content_item_id: contentItemId, state, awaiting_review: state === "REQUESTED" };
}

export async function removeFromLibrary(user: AuthUser, childId: string, contentItemId: string) {
  await childRow(user, childId);
  await getPool().query(
    "UPDATE library_items SET state = 'REMOVED', updated_at = now() WHERE child_profile_id = $1 AND content_item_id = $2",
    [childId, contentItemId],
  );
  return { content_item_id: contentItemId, state: "REMOVED" };
}

// ── URL submissions (plan: parent-submitted URLs) ─────────────────────────────
function assessmentState(row: Row | undefined): "PENDING" | "SCORED" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW" | null {
  if (!row) return null;
  if (row.current_status === "APPROVED") return "APPROVED";
  if (row.current_status === "REJECTED") return "REJECTED";
  if (row.analysis_status === "QUEUED" || row.analysis_status === "ANALYSING") return "PENDING";
  return row.kidq_score !== null ? "SCORED" : "NEEDS_REVIEW";
}

function toSubmission(row: Row, cardRow: Row | undefined) {
  const card = cardRow ? toCard(cardRow) : null;
  return {
    id: row.id,
    url: row.url,
    status: row.status,
    error: row.error,
    created_at: toIso(row.created_at),
    assessment: assessmentState(cardRow),
    card: card && cardRow?.current_status !== "APPROVED" ? { ...card, player: null } : card,
  };
}

export async function submitUrl(user: AuthUser, childId: string, url: string) {
  await childRow(user, childId);
  const db = getPool();
  const today = (
    await db.query("SELECT count(*)::int AS n FROM content_submissions WHERE parent_user_id = $1 AND created_at > now() - interval '1 day'", [user.id])
  ).rows[0].n;
  if (today >= SUBMISSIONS_PER_DAY) throw new ApiError(429, "SUBMISSION_LIMIT", `You can add up to ${SUBMISSIONS_PER_DAY} videos a day.`);
  const videoId = parseYouTubeId(url);
  if (!videoId) throw new ApiError(422, "INVALID_URL", "Only public YouTube video links can be added right now.");

  let contentItemId = (
    await db.query("SELECT content_item_id FROM source_records WHERE source_system_id = 'youtube' AND external_id = $1", [videoId])
  ).rows[0]?.content_item_id as string | undefined;

  if (!contentItemId) {
    // One quick metadata call so the parent sees the item at once; scoring stays asynchronous.
    const run = (
      await db.query(
        `INSERT INTO ingestion_runs (source_system_id, query, status, connector_version, requested_by)
         VALUES ('youtube', $1, 'RUNNING', '2', $2) RETURNING id`,
        [JSON.stringify({ mode: "urls", urls: [url], via: "parent_submission" }), `parent:${user.id}`],
      )
    ).rows[0].id;
    const batch = await fetchYouTubeVideos([videoId]);
    const record = batch.records[0];
    await db.query(
      `UPDATE ingestion_runs SET status = $2, records_seen = 1, records_created = $3, records_rejected_before_ai = $4, finished_at = now() WHERE id = $1`,
      [run, record ? "SUCCEEDED" : "PARTIAL", record ? 1 : 0, record ? 0 : 1],
    );
    if (!record) {
      throw new ApiError(422, "VIDEO_NOT_AVAILABLE", "This video is private, unavailable, too long, or can't be played inside KidQ.", {
        reason: batch.errors[0]?.code ?? null,
      });
    }
    contentItemId = (await upsertRecord(record, run, PARENT_PRIORITY)).contentItemId;
  } else {
    await db.query("UPDATE outbox_events SET priority = GREATEST(priority, $2) WHERE dedupe_key = $1 AND status = 'PENDING'", [
      `analyze:${contentItemId}`,
      PARENT_PRIORITY,
    ]);
  }

  const submission = (
    await db.query(
      `INSERT INTO content_submissions (parent_user_id, child_profile_id, url, content_item_id, status)
       VALUES ($1, $2, $3, $4, 'ACCEPTED') RETURNING *`,
      [user.id, childId, url, contentItemId],
    )
  ).rows[0];
  const cards = await getCardRows(db, [contentItemId], { approvedOnly: false });
  return toSubmission(submission, cards.get(contentItemId));
}

export async function listSubmissions(user: AuthUser, childId: string) {
  await childRow(user, childId);
  const db = getPool();
  const { rows } = await db.query(
    "SELECT * FROM content_submissions WHERE parent_user_id = $1 AND child_profile_id = $2 ORDER BY created_at DESC LIMIT 100",
    [user.id, childId],
  );
  const cards = await getCardRows(db, rows.map((row) => row.content_item_id).filter(Boolean), { approvedOnly: false });
  return { items: rows.map((row) => toSubmission(row, cards.get(row.content_item_id))) };
}
