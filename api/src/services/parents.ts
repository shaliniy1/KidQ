// Parent side: child profiles (onboarding), recommendations, the parent-approved library and
// URL submissions. Every query is scoped to the signed-in parent; unapproved content is
// invisible except a parent's own submissions, which wait for admin approval.
import { fetchYouTubeVideos, parseYouTubeId } from "../connectors/youtube";
import { getPool, type Db } from "../db/pool";
import { childAgeYears, recommend, type CandidateInput, type ChildProfileInput } from "../domain/recommendation";
import type { AuthUser } from "../http/auth";
import { ApiError, notFound } from "../http/errors";
import type { ChildBody } from "../http/schemas";
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

function toChild(row: Row) {
  return {
    id: row.id,
    nickname: row.nickname,
    birth_year: row.birth_year,
    birth_month: row.birth_month,
    age_years: childAgeYears(row.birth_year, row.birth_month),
    languages: row.languages,
    interests: row.interests,
    content_types: row.content_types,
    preferred_categories: row.preferred_categories,
    development_goals: row.development_goals,
    regulation_goals: row.regulation_goals,
    daily_minutes: row.daily_minutes,
    break_preference: row.break_preference,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

async function assertOnboardingKeys(profile: Partial<ChildBody>) {
  const taxonomy = await listTaxonomy(getPool());
  const check = (kind: TaxonomyKind, field: string, values: string[] | undefined) => {
    const unknown = (values ?? []).filter((value) => !keysOf(taxonomy, kind).includes(value));
    if (unknown.length) throw new ApiError(400, "UNKNOWN_TAXONOMY_KEY", `Unknown ${field}: ${unknown.join(", ")}. Use keys from GET /taxonomy.`, { field, unknown });
  };
  check("interest", "interests", profile.interests);
  check("category", "preferred_categories", profile.preferred_categories);
  check("development_goal", "development_goals", profile.development_goals);
  check("regulation_goal", "regulation_goals", profile.regulation_goals);
}

async function childRow(user: AuthUser, childId: string): Promise<Row> {
  const row = (await getPool().query("SELECT * FROM child_profiles WHERE id = $1 AND parent_user_id = $2", [childId, user.id])).rows[0];
  // Another family's child looks exactly like a missing one.
  if (!row) throw notFound("Child");
  return row;
}

// ── Child profiles ────────────────────────────────────────────────────────────
export async function listChildren(user: AuthUser) {
  const { rows } = await getPool().query("SELECT * FROM child_profiles WHERE parent_user_id = $1 ORDER BY created_at", [user.id]);
  return { items: rows.map(toChild) };
}

export async function getChild(user: AuthUser, childId: string) {
  return toChild(await childRow(user, childId));
}

const CHILD_FIELDS = [
  "nickname",
  "birth_year",
  "birth_month",
  "languages",
  "interests",
  "content_types",
  "preferred_categories",
  "development_goals",
  "regulation_goals",
  "daily_minutes",
  "break_preference",
] as const;

export async function createChild(user: AuthUser, body: ChildBody) {
  await assertOnboardingKeys(body);
  const values = CHILD_FIELDS.map((field) => body[field]);
  const placeholders = CHILD_FIELDS.map((_, index) => `$${index + 2}`).join(", ");
  const { rows } = await getPool().query(
    `INSERT INTO child_profiles (parent_user_id, ${CHILD_FIELDS.join(", ")}) VALUES ($1, ${placeholders}) RETURNING *`,
    [user.id, ...values],
  );
  return toChild(rows[0]);
}

export async function updateChild(user: AuthUser, childId: string, patch: Partial<ChildBody>) {
  await childRow(user, childId);
  await assertOnboardingKeys(patch);
  const fields = CHILD_FIELDS.filter((field) => field in patch);
  if (fields.length === 0) return getChild(user, childId);
  const sets = fields.map((field, index) => `${field} = $${index + 3}`).join(", ");
  const { rows } = await getPool().query(
    `UPDATE child_profiles SET ${sets}, updated_at = now() WHERE id = $1 AND parent_user_id = $2 RETURNING *`,
    [childId, user.id, ...fields.map((field) => patch[field])],
  );
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

function profileFrom(row: Row | ChildProfileLike, ageYears: number): ChildProfileInput {
  return {
    ageYears,
    languages: row.languages,
    contentTypes: row.content_types,
    interests: row.interests,
    developmentGoals: row.development_goals,
    regulationGoals: row.regulation_goals,
    preferredCategories: row.preferred_categories,
    dailyMinutes: row.daily_minutes,
  };
}

interface ChildProfileLike {
  languages: string[];
  content_types: string[];
  interests: string[];
  development_goals: string[];
  regulation_goals: string[];
  preferred_categories: string[];
  daily_minutes: number | null;
}

export async function recommendationsFor(user: AuthUser, childId: string, paging: { limit: number; offset: number }) {
  const child = await childRow(user, childId);
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
  return rankFor(db, profileFrom(child, childAgeYears(child.birth_year, child.birth_month)), excluded, paging.limit, paging.offset);
}

/** Admin preview: what would a child with this profile see right now? */
export async function previewRecommendations(profile: ChildProfileLike & { age_years: number; limit: number }) {
  return rankFor(getPool(), profileFrom(profile, profile.age_years), new Set(), profile.limit, 0);
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
