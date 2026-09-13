// Read models for content: the shared content card (with its content_score display object and
// player), the admin list/queue, and the admin detail with the README canonical record.
import type { Db } from "../db/pool";
import { AGE_GROUPS, ageBandsFor } from "../domain/age";
import { LEARNING_AREA_LABELS, RUBRIC, type LearningArea } from "../domain/rubric";
import { resolvedCriteria, type AssessorType, type ComponentResult, type SafetyFlag } from "../domain/scoring";
import type { ListContentQuery } from "../http/schemas";
import { loadAssessments } from "./assessments";

// Restricted YouTube playback (plan: "KidQ Player"). Served on youtube-nocookie.com.
export const YOUTUBE_PLAYER_PARAMS = { controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, rel: 0, playsinline: 1, autoplay: 0 };

const CARD_SELECT = `
  SELECT v.*, ks.components AS score_detail, ks.reason AS score_reason, ks.missing AS score_missing,
    (SELECT count(*)::int FROM library_items li WHERE li.content_item_id = v.id AND li.state = 'REQUESTED') AS parent_requests,
    (SELECT jsonb_array_length(s.story->'pages') FROM source_records s WHERE s.id = v.source_record_id) AS story_page_count
  FROM content_records_v v
  LEFT JOIN LATERAL (SELECT components, reason, missing FROM kidq_scores
                     WHERE content_item_id = v.id ORDER BY created_at DESC LIMIT 1) ks ON true`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const toIso = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? String(value) : null);
const sourceLabel = (source: AssessorType | null) => (source === "MODEL" ? "AI" : source === "HUMAN" ? "ADMIN" : source === "RULE" ? "RULE" : null);

function toContentScore(row: Row) {
  if (!row.score_detail) return null;
  const detail = row.score_detail as { components: ComponentResult[]; safetyFlags: SafetyFlag[] };
  const sources = new Set(detail.components.map((component) => component.source));
  const approved = row.current_status === "APPROVED";
  const evaluatedBy =
    sources.has("HUMAN") && sources.has("MODEL")
      ? "AI, adjusted by KidQ admin"
      : sources.has("HUMAN")
        ? "KidQ admin"
        : sources.has("MODEL")
          ? approved
            ? "AI, reviewed by KidQ admin"
            : "AI"
          : "Rule checks only";
  return {
    score: toNumber(row.kidq_score),
    confidence: toNumber(row.kidq_confidence) ?? 0,
    version: row.kidq_score_version ?? null,
    breakdown: detail.components.map((component) => ({
      key: component.component,
      label: component.label,
      score: component.value,
      weight: component.weight,
      source: sourceLabel(component.source),
      evidence: component.evidence,
      timestamps: component.timestamps,
      capped_by: component.cap?.criterion ?? null,
    })),
    reason: row.score_reason ?? "",
    missing: row.score_missing ?? [],
    safety_flags: detail.safetyFlags.map(({ key, evidence, timestamps }) => ({ key, evidence, timestamps })),
    evaluated_by: evaluatedBy,
    reviewed_at: approved ? toIso(row.published_at) : null,
  };
}

function toPlayer(row: Row) {
  // Picture books open in the KidQ story reader (GET /content-items/:id/story).
  if (row.content_type === "STORYBOOK") return row.story_page_count ? { provider: "story" as const, page_count: row.story_page_count as number } : null;
  if (row.source === "youtube" && row.external_id) {
    return {
      provider: "youtube" as const,
      video_id: row.external_id as string,
      embed_url: `https://www.youtube-nocookie.com/embed/${row.external_id}`,
      params: YOUTUBE_PLAYER_PARAMS,
    };
  }
  if (row.media_url) return { provider: "html5" as const, media_url: row.media_url as string, mime_type: row.media_mime_type ?? null };
  return null;
}

function toLearning(row: Row) {
  const areas = ((row.score_detail?.learning?.areas ?? []) as LearningArea[]).map((area) => LEARNING_AREA_LABELS[area] ?? area);
  return { value: toNumber(row.learning_value), areas };
}

export function toCard(row: Row) {
  const ageMin = toNumber(row.age_min);
  const ageMax = toNumber(row.age_max);
  return {
    id: row.id as string,
    title: row.title as string,
    kidq_summary: row.kidq_summary ?? null,
    content_type: row.content_type,
    source: row.source,
    creator: row.channel_or_creator ?? null,
    duration_seconds: row.duration_seconds ?? null,
    language: row.language ?? null,
    thumbnails: row.thumbnails ?? {},
    thumbnail_url: row.thumbnail_url ?? null,
    age: { min: ageMin, max: ageMax, groups: ageBandsFor(ageMin, ageMax) },
    category: row.category ?? null,
    categories: (row.categories?.length ? row.categories : row.category ? [row.category] : []) as string[],
    interests: row.interests ?? [],
    development_goals: row.development_goals ?? [],
    regulation_goals: row.regulation_goals ?? [],
    content_score: toContentScore(row),
    learning: toLearning(row),
    player: toPlayer(row),
    attribution: {
      text: row.attribution_text ?? null,
      required: row.attribution_required ?? null,
      license_name: row.license_name ?? null,
      license_url: row.license_url ?? null,
    },
  };
}
export type ContentCard = ReturnType<typeof toCard>;

export function toAdminCard(row: Row) {
  return {
    ...toCard(row),
    studio_state: row.studio_state,
    analysis_status: row.analysis_status,
    current_status: row.current_status,
    publish_blockers: row.publish_blockers ?? [],
    has_critical_flag: row.has_critical_flag,
    parent_requests: row.parent_requests ?? 0,
    created_at: toIso(row.created_at) as string,
    published_at: toIso(row.published_at),
  };
}

function toStory(row: Row, story: { pages: unknown[]; credits?: string | null }) {
  return {
    title: row.title as string,
    pages: story.pages,
    credits: story.credits ?? null,
    attribution: { text: row.attribution_text ?? null, license_name: row.license_name ?? null, license_url: row.license_url ?? null },
  };
}

/** A picture book's pages and credits for the KidQ reader; parents only ever get published books. */
export async function getStory(db: Db, id: string, options: { approvedOnly: boolean }) {
  const row = (
    await db.query(
      `SELECT v.title, v.attribution_text, v.license_name, v.license_url, s.story
       FROM content_records_v v JOIN source_records s ON s.id = v.source_record_id
       WHERE v.id = $1 AND s.story IS NOT NULL ${options.approvedOnly ? "AND v.current_status = 'APPROVED'" : ""}`,
      [id],
    )
  ).rows[0];
  return row ? toStory(row, row.story) : null;
}

export async function listAdminContent(db: Db, filters: ListContentQuery, extraWhere: string[] = []) {
  const where = [...extraWhere];
  const params: unknown[] = [];
  const add = (sql: (placeholder: string) => string, value: unknown) => {
    params.push(value);
    where.push(sql(`$${params.length}`));
  };
  if (filters.state) add((p) => `v.studio_state = ${p}`, filters.state);
  // Any of an item's categories matches, so a counting picture book shows under Maths too.
  if (filters.category) add((p) => `(v.category = ${p} OR ${p} = ANY(v.categories))`, filters.category);
  if (filters.source) add((p) => `v.source = ${p}`, filters.source);
  if (filters.flagged) add((p) => `v.has_critical_flag = ${p}`, filters.flagged === "true");
  if (filters.min_score !== undefined) add((p) => `v.kidq_score >= ${p}`, filters.min_score);
  if (filters.q) {
    const normalizedAge = filters.q.toLowerCase().replace(/[–—]/g, "-").replace(/years?|age/g, "").trim();
    const searchedAge = AGE_GROUPS.find((group) => normalizedAge === group.key.replace("_", "-") || normalizedAge === `${group.min}-${group.max}`);
    const ageSearch = searchedAge ? `OR (v.age_min < ${searchedAge.max} AND v.age_max > ${searchedAge.min})` : "";
    add(
      (p) => `(v.title ILIKE ${p}
        OR v.channel_or_creator ILIKE ${p}
        OR v.kidq_summary ILIKE ${p}
        OR replace(array_to_string(v.categories, ' '), '_', ' ') ILIKE ${p}
        OR replace(v.category, '_', ' ') ILIKE ${p}
        OR replace(v.content_type, '_', ' ') ILIKE ${p}
        OR array_to_string(v.interests, ' ') ILIKE ${p}
        OR array_to_string(v.keywords, ' ') ILIKE ${p}
        OR array_to_string(v.development_goals, ' ') ILIKE ${p}
        OR array_to_string(v.regulation_goals, ' ') ILIKE ${p}
        ${ageSearch})`,
      `%${filters.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`,
    );
  }
  if (filters.age_group) {
    const group = AGE_GROUPS.find((g) => g.key === filters.age_group);
    if (group) {
      add((p) => `v.age_min < ${p}`, group.max);
      add((p) => `v.age_max > ${p}`, group.min);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order =
    filters.sort === "score" ? "v.kidq_score DESC NULLS LAST, v.created_at DESC" : filters.sort === "title" ? "v.title ASC" : "v.created_at DESC";
  const total = (await db.query(`SELECT count(*)::int AS n FROM content_records_v v ${whereSql}`, params)).rows[0].n as number;
  const rows = (
    await db.query(`${CARD_SELECT} ${whereSql} ORDER BY ${order}, v.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
      ...params,
      filters.limit,
      filters.offset,
    ])
  ).rows;
  return { items: rows.map(toAdminCard), total, limit: filters.limit, offset: filters.offset };
}

/** Items an admin should act on; parent requests first. */
export async function listReviewQueue(db: Db, limit: number, offset: number) {
  const whereSql = "WHERE v.studio_state IN ('READY_TO_APPROVE', 'NEEDS_ATTENTION', 'ANALYSIS_INCOMPLETE', 'FAILED')";
  const total = (await db.query(`SELECT count(*)::int AS n FROM content_records_v v ${whereSql}`)).rows[0].n as number;
  const rows = (
    await db.query(`SELECT * FROM (${CARD_SELECT} ${whereSql}) q ORDER BY q.parent_requests DESC, q.created_at, q.id LIMIT $1 OFFSET $2`, [limit, offset])
  ).rows;
  return { items: rows.map(toAdminCard), total, limit, offset };
}

/** Every published item — the only pool recommendations are drawn from. */
export async function listApprovedCardRows(db: Db): Promise<Row[]> {
  return (await db.query(`${CARD_SELECT} WHERE v.current_status = 'APPROVED'`)).rows;
}

export async function getCardRows(db: Db, ids: string[], options: { approvedOnly: boolean }): Promise<Map<string, Row>> {
  if (ids.length === 0) return new Map();
  const rows = (
    await db.query(`${CARD_SELECT} WHERE v.id = ANY($1::uuid[]) ${options.approvedOnly ? "AND v.current_status = 'APPROVED'" : ""}`, [ids])
  ).rows;
  return new Map(rows.map((row) => [row.id as string, row]));
}

export async function getAdminDetail(db: Db, id: string) {
  const row = (await db.query(`${CARD_SELECT} WHERE v.id = $1`, [id])).rows[0];
  if (!row) return null;
  const [assessments, meta, decisions, revisions, source] = await Promise.all([
    loadAssessments(db, id),
    db.query(
      `SELECT id, assessor_type, assessor_name, model_name, model_snapshot, prompt_version, rubric_version, result, summary,
         audiovisual_inspected, input_tokens, output_tokens, estimated_cost_usd, created_at
       FROM assessments WHERE content_item_id = $1 ORDER BY created_at DESC`,
      [id],
    ),
    db.query(
      `SELECT decision, reason, decided_by, decision_source, overrode_critical_flag, decided_at
       FROM publication_decisions WHERE content_item_id = $1 ORDER BY decided_at DESC`,
      [id],
    ),
    db.query("SELECT changes, edited_by, created_at FROM editorial_revisions WHERE content_item_id = $1 ORDER BY created_at DESC", [id]),
    db.query(
      `SELECT sr.connector_version, sr.raw_metadata, sr.story FROM (
         SELECT s.*, ss.connector_version FROM source_records s JOIN source_systems ss ON ss.id = s.source_system_id
         WHERE s.content_item_id = $1 ORDER BY s.fetched_at DESC LIMIT 1) sr`,
      [id],
    ),
  ]);

  const byId = new Map(assessments.map((assessment) => [assessment.id, assessment]));
  const criteria = resolvedCriteria(assessments);
  const results = (group: "FILTER_OUT" | "FILTER_IN") =>
    Object.fromEntries(
      RUBRIC.filter((c) => c.group === group).map((c) => {
        const resolved = criteria.get(c.key);
        return [c.key, { result: resolved?.result ?? "UNKNOWN", evidence: resolved?.evidence ?? "Not assessed yet." }];
      }),
    );
  const filterOut = results("FILTER_OUT");
  const filterIn = results("FILTER_IN");
  const rejection = decisions.rows.find((d) => d.decision === "REJECTED");
  const card = toAdminCard(row);

  // README "Required content record": every key present, null / [] when unknown.
  const record = {
    content_id: `${row.source}:${row.external_id}`,
    content_type: row.content_type,
    title: row.title,
    source: row.source,
    source_url: row.source_url,
    embed_url: row.embed_url ?? null,
    source_video_id: row.source === "youtube" ? row.external_id : null,
    channel_or_creator: row.channel_or_creator ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    duration_seconds: row.duration_seconds ?? null,
    language: row.language ?? null,
    caption_available: row.caption_available ?? false,
    transcript: row.transcript_text ?? null,
    transcript_source: row.transcript_status === "AVAILABLE" ? row.transcript_origin : null,
    description: row.description ?? null,
    made_for_kids: row.made_for_kids ?? null,
    embeddable: row.embeddable ?? null,
    license_if_known: row.license_name ?? null,
    category: row.category ?? null,
    subcategory: row.subcategory ?? null,
    age_min: card.age.min,
    age_max: card.age.max,
    age_band: card.age.groups,
    learning_objective: row.learning_objective ?? null,
    skills_developed: row.skills ?? [],
    topics: row.interests ?? [],
    keywords: row.keywords ?? [],
    activity_supported: false,
    activity_title: null,
    activity_instruction: null,
    activity_duration_seconds: null,
    activity_type: null,
    filter_out: filterOut,
    filter_in: filterIn,
    filter_out_fail_count: Object.values(filterOut).filter((c) => c.result === "FAIL").length,
    filter_in_pass_count: Object.values(filterIn).filter((c) => c.result === "PASS").length,
    content_status: row.current_status,
    rejection_reason: row.current_status === "REJECTED" ? (rejection?.reason ?? null) : null,
    manual_review_reason:
      row.current_status === "MANUAL_REVIEW_REQUIRED"
        ? card.publish_blockers.length
          ? `Blocked by: ${card.publish_blockers.join(", ")}`
          : "Awaiting admin approval."
        : null,
    kidq_summary: row.kidq_summary ?? null,
    fetched_at: toIso(row.fetched_at),
    provenance: {
      method: `${row.source}_api`,
      connector_version: source.rows[0]?.connector_version ?? null,
      inspected_fields:
        row.source === "youtube"
          ? ["snippet", "contentDetails", "status", "topicDetails"]
          : row.source === "storyweaver"
            ? ["books-search", "story reader pages"]
            : ["search", "asset metadata"],
      audiovisual_inspected: meta.rows.some((a) => a.audiovisual_inspected),
    },
  };

  return {
    content: card,
    record,
    assessments: meta.rows.map((a) => ({
      id: a.id,
      assessor_type: a.assessor_type,
      assessor_name: a.assessor_name,
      model_name: a.model_name,
      model_snapshot: a.model_snapshot,
      prompt_version: a.prompt_version,
      rubric_version: a.rubric_version,
      result: a.result,
      summary: a.summary,
      audiovisual_inspected: a.audiovisual_inspected,
      input_tokens: a.input_tokens,
      output_tokens: a.output_tokens,
      estimated_cost_usd: toNumber(a.estimated_cost_usd),
      created_at: toIso(a.created_at),
      scores: byId.get(a.id)?.scores ?? [],
      criteria: byId.get(a.id)?.criteria ?? [],
    })),
    decisions: decisions.rows.map((d) => ({ ...d, decided_at: toIso(d.decided_at) })),
    revisions: revisions.rows.map((r) => ({ ...r, created_at: toIso(r.created_at) })),
    rights: {
      license_name: row.license_name,
      license_url: row.license_url,
      attribution_text: row.attribution_text,
      attribution_required: row.attribution_required,
      allows_embedding: row.allows_embedding,
      allows_media_storage: row.allows_media_storage,
      allows_transcript_storage: row.allows_transcript_storage,
    },
    transcript_status: row.transcript_status ?? null,
    raw_metadata: source.rows[0]?.raw_metadata ?? null,
    story: source.rows[0]?.story ? toStory(row, source.rows[0].story) : null,
  };
}
