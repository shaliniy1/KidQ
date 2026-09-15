// Start a Session (docs/recommendation/parent-experience.md §4–5) and child mode (design/, PR #5):
// builds one sitting's queue from the child's parent-approved library with a break activity after each
// slot, serves today's live session and a replay of an earlier one, records how each video went (and
// where it stopped), and serves the handoff log. Scoped to the signed-in parent; another family's
// child or session is a 404.
import type { PoolClient } from "pg";
import { getPool, withTransaction, type Db } from "../db/pool";
import { parentCategoriesFrom } from "../domain/parent-categories";
import { PRESET_MINUTES, assembleSession, type AssembleOptions, type BreakKind, type SessionCandidate } from "../domain/session";
import { assignBreaks, describeBreak, type BreakActivity } from "../domain/session/breaks";
import { openerBand, sessionContext, type SessionMode, type TimeBand } from "../domain/time-of-day";
import { recommend } from "../domain/recommendation";
import type { AuthUser } from "../http/auth";
import { ApiError, notFound } from "../http/errors";
import { getActiveRankingConfig } from "../repositories/config";
import { getCardRows, toCard, type ContentCard } from "../repositories/content";
import { listTaxonomy } from "../repositories/taxonomy";
import { childRow, profileOf, toCandidate, toChild } from "./parents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Child = ReturnType<typeof toChild>;
const toIso = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? String(value) : null);
// "Help them calm down" and "Wind down before bed"; no regulation goals means all six.
const CALMING_GOALS = ["calm", "relaxation"];
const LOG_LENGTH = 20;
/** A session started longer ago than this is no longer "today's" live session. */
const LIVE_HOURS = 12;

/** How calm an item is: the mean of its pacing and audio comfort scores. */
function calmOf(card: ContentCard): number | null {
  const parts = (card.content_score?.breakdown ?? []).filter((part) => (part.key === "PACING" || part.key === "AUDIO_COMFORT") && part.score !== null);
  return parts.length ? parts.reduce((sum, part) => sum + (part.score ?? 0), 0) / parts.length : null;
}

function toSessionCandidate(row: Row): SessionCandidate {
  const groups = (row.parent_categories ?? []) as string[];
  return {
    id: row.id,
    durationSeconds: row.duration_seconds ?? null,
    category: groups[0] ?? row.category ?? null,
    calm: calmOf(toCard(row)),
    groups,
    modes: row.session_modes ?? [],
  };
}

function toBreakActivity(row: Row): BreakActivity {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    instruction: row.instruction,
    spokenInstruction: row.spoken_instruction ?? row.instruction,
    durationSeconds: row.duration_seconds ?? 30,
    breakType: row.break_type as BreakKind,
    variants: row.variants ?? [],
  };
}

async function sessionRow(db: Db, user: AuthUser, sessionId: string): Promise<Row> {
  const row = (
    await db.query("SELECT s.* FROM sessions s JOIN child_profiles c ON c.id = s.child_profile_id WHERE s.id = $1 AND c.parent_user_id = $2", [sessionId, user.id])
  ).rows[0];
  if (!row) throw notFound("Session");
  return row;
}

async function toSessions(db: Db, sessions: Row[]) {
  if (sessions.length === 0) return [];
  const ids = sessions.map((session) => session.id);
  const [items, breaks] = await Promise.all([
    db.query("SELECT * FROM session_items WHERE session_id = ANY($1) ORDER BY position", [ids]).then((result) => result.rows),
    db
      .query("SELECT b.session_id, b.slot, b.variant, a.* FROM session_breaks b JOIN activities a ON a.id = b.activity_id WHERE b.session_id = ANY($1)", [ids])
      .then((result) => result.rows),
  ]);
  const cards = await getCardRows(db, [...new Set(items.map((item) => item.content_item_id as string))], { approvedOnly: false });
  return sessions.map((session) => {
    const own = items.filter((item) => item.session_id === session.id);
    const lengthOf = (item: Row) => cards.get(item.content_item_id)?.duration_seconds ?? null;
    return {
      id: session.id as string,
      child_id: session.child_profile_id as string,
      minutes: session.minutes as number,
      started_at: toIso(session.started_at) as string,
      ended_at: toIso(session.ended_at),
      outcome: session.outcome ?? null,
      short_by_minutes: session.short_by_minutes as number,
      mode: session.mode as SessionMode,
      time_band: (session.time_band ?? null) as TimeBand | null,
      opener: { band: openerBand(session.mode, session.time_band ?? "DAYTIME") },
      wind_down: session.wind_down as "STANDARD" | "CALM" | "SLEEP",
      lean_toward: (session.lean_toward ?? null) as string | null,
      // The sky: the chosen time, what the queue holds, and how much has been watched. Rewatching a
      // video never pushes the sun forward, and switching videos never rewinds it.
      planned_seconds: session.planned_seconds as number,
      filled_seconds: own.reduce((sum, item) => sum + (lengthOf(item) ?? 0), 0),
      progress_seconds: own.reduce((sum, item) => sum + Math.min(item.watched_seconds ?? 0, lengthOf(item) ?? item.watched_seconds ?? 0), 0),
      slots: (session.breaks as string[]).map((breakAfter, index) => {
        const assigned = breaks.find((row) => row.session_id === session.id && row.slot === index + 1);
        return {
          slot: index + 1,
          break_after: breakAfter,
          break_activity: assigned ? describeBreak(toBreakActivity(assigned), assigned.variant ?? null) : null,
          items: own
            .filter((item) => item.slot === index + 1)
            .flatMap((item) => {
              const cardRow = cards.get(item.content_item_id);
              if (!cardRow) return [];
              const card = toCard(cardRow);
              // Something unpublished since stays in the log, but can't be played.
              const playable = cardRow.current_status === "APPROVED";
              return [
                {
                  id: item.id as string,
                  position: item.position as number,
                  outcome: item.outcome ?? null,
                  watched_seconds: item.watched_seconds ?? null,
                  position_seconds: item.position_seconds ?? null,
                  activity_breakpoints: item.activity_breakpoints ?? [],
                  card: playable ? card : { ...card, player: null },
                },
              ];
            }),
        };
      }),
    };
  });
}

/** Library order in; slots, breaks and the session's context out, saved in one transaction. */
async function saveSession(
  childId: string,
  child: Child,
  library: SessionCandidate[],
  input: { minutes: number; mode: SessionMode; leanToward: string | null; keepOrder: boolean; rememberMode: boolean },
) {
  const db = getPool();
  const calmingGoal = child.regulation_goals.some((goal) => CALMING_GOALS.includes(goal));
  const context = sessionContext(new Date(), input.mode, calmingGoal);
  // No regulation goals means all six, calming ones included: the last slot still leans calm.
  const options: AssembleOptions = {
    breakType: child.break_type,
    calmEnding: context.windDown !== "STANDARD" || child.regulation_goals.length === 0,
    intervalMinutes: child.break_interval_minutes,
    // A replay keeps the earlier session's order, so nothing re-sorts it.
    ...(input.keepOrder ? {} : { contentMode: context.contentMode, bias: context.bias, leanToward: input.leanToward }),
  };
  const assembled = assembleSession(library, input.minutes, options);
  const [activities, recent, sessionCount] = await Promise.all([
    db.query("SELECT * FROM activities WHERE break_type IS NOT NULL AND key IS NOT NULL ORDER BY key").then((result) => result.rows.map(toBreakActivity)),
    db
      .query(
        `SELECT a.key FROM session_breaks b JOIN activities a ON a.id = b.activity_id
         WHERE b.session_id = (SELECT id FROM sessions WHERE child_profile_id = $1 ORDER BY started_at DESC LIMIT 1)`,
        [childId],
      )
      .then((result) => result.rows.map((row) => row.key as string)),
    db.query("SELECT count(*)::int AS n FROM sessions WHERE child_profile_id = $1", [childId]).then((result) => result.rows[0].n as number),
  ]);
  const breaks = assignBreaks(assembled.slots, activities, { recentKeys: recent, windDown: context.windDown, seed: sessionCount });

  const session = await withTransaction(async (client: PoolClient) => {
    const breakpointRows = (await client.query(
      "SELECT content_item_id, activity_breakpoints FROM library_items WHERE child_profile_id = $1 AND state = 'ADDED' AND content_item_id = ANY($2)",
      [childId, library.map((item) => item.id)],
    )).rows;
    const breakpointsByContent = new Map(breakpointRows.map((item) => [item.content_item_id as string, item.activity_breakpoints ?? []]));
    const row = (
      await client.query(
        `INSERT INTO sessions (child_profile_id, minutes, breaks, planned_seconds, short_by_minutes, mode, time_band, wind_down, lean_toward)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          childId,
          assembled.minutes,
          assembled.slots.map((slot) => slot.breakAfter),
          assembled.plannedSeconds,
          assembled.shortByMinutes,
          input.mode,
          context.timeBand,
          context.windDown,
          input.leanToward,
        ],
      )
    ).rows[0];
    let position = 0;
    for (const slot of assembled.slots) {
      for (const contentItemId of slot.itemIds) {
        position += 1;
        await client.query("INSERT INTO session_items (session_id, content_item_id, slot, position, activity_breakpoints) VALUES ($1, $2, $3, $4, $5::jsonb)", [row.id, contentItemId, slot.slot, position, JSON.stringify(breakpointsByContent.get(contentItemId) ?? [])]);
      }
    }
    for (const assigned of breaks) {
      await client.query("INSERT INTO session_breaks (session_id, slot, activity_id, variant) VALUES ($1, $2, $3, $4)", [row.id, assigned.slot, assigned.activity.id, assigned.variant]);
    }
    // The next Start a Session opens on this length and mode, for this child only; lean_toward is never kept.
    if (PRESET_MINUTES.includes(assembled.minutes)) {
      await client.query("UPDATE child_profiles SET session_minutes = $2, updated_at = now() WHERE id = $1", [childId, assembled.minutes]);
    }
    if (input.rememberMode) await client.query("UPDATE child_profiles SET session_mode = $2, updated_at = now() WHERE id = $1", [childId, input.mode]);
    return row;
  });
  return (await toSessions(db, [session]))[0];
}

/**
 * Builds the session and starts it at once: the child never sees a start button or a timer to change.
 * The clock (in IST) or the parent's session mode shapes which videos lead and how it winds down.
 */
export async function startSession(user: AuthUser, childId: string, input: { minutes: number; mode?: SessionMode; lean_toward?: string }) {
  const child = toChild(await childRow(user, childId));
  const db = getPool();
  if (input.lean_toward) {
    const groups = parentCategoriesFrom((await listTaxonomy(db)).parent_category);
    if (!groups.some((group) => group.key === input.lean_toward)) {
      throw new ApiError(400, "UNKNOWN_TAXONOMY_KEY", `Unknown lean_toward: ${input.lean_toward}. Use a parent_category key from GET /taxonomy.`);
    }
  }
  const libraryIds = (await db.query("SELECT content_item_id FROM library_items WHERE child_profile_id = $1 AND state = 'ADDED'", [childId])).rows.map(
    (row) => row.content_item_id as string,
  );
  const [config, cards] = await Promise.all([getActiveRankingConfig(db), getCardRows(db, libraryIds, { approvedOnly: true })]);
  const rows = [...cards.values()];
  // The parent already chose these, so the child's age and category filters don't apply; ranking only orders them.
  const ranked = recommend(profileOf(child), rows.map(toCandidate), config, new Set(), { limit: Math.max(rows.length, 1), hardFilters: false });
  const library = ranked.map(({ contentId }) => toSessionCandidate(cards.get(contentId) as Row));
  return saveSession(childId, child, library, {
    minutes: input.minutes,
    mode: input.mode ?? child.session_mode,
    leanToward: input.lean_toward ?? null,
    keepOrder: false,
    rememberMode: input.mode !== undefined,
  });
}

/** Child mode opens on this: the live session the parent started today, or null ("the sun is still asleep"). */
export async function currentSession(user: AuthUser, childId: string) {
  const child = await childRow(user, childId);
  const db = getPool();
  const timezone = (await db.query("SELECT timezone FROM parent_profiles WHERE parent_user_id = $1", [child.parent_user_id])).rows[0]?.timezone ?? "UTC";
  const row = (
    await db.query(
      `SELECT * FROM sessions WHERE child_profile_id = $1 AND ended_at IS NULL
         AND started_at > now() - make_interval(hours => $3)
         AND (started_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
       ORDER BY started_at DESC LIMIT 1`,
      [childId, timezone, LIVE_HOURS],
    )
  ).rows[0];
  return { session: row ? (await toSessions(db, [row]))[0] : null };
}

/**
 * Plays an earlier session again as a new one: the same videos in the same order, minutes and mode,
 * minus any no longer in the child's library or no longer published. The old session is never resumed.
 */
export async function replaySession(user: AuthUser, sessionId: string) {
  const db = getPool();
  const earlier = await sessionRow(db, user, sessionId);
  const childId = earlier.child_profile_id as string;
  const child = toChild(await childRow(user, childId));
  const ids = (
    await db.query(
      `SELECT si.content_item_id FROM session_items si
       JOIN library_items li ON li.child_profile_id = $2 AND li.content_item_id = si.content_item_id AND li.state = 'ADDED'
       WHERE si.session_id = $1 ORDER BY si.position`,
      [sessionId, childId],
    )
  ).rows.map((row) => row.content_item_id as string);
  const cards = await getCardRows(db, ids, { approvedOnly: true });
  const library = ids.filter((id) => cards.has(id)).map((id) => toSessionCandidate(cards.get(id) as Row));
  if (library.length === 0) throw new ApiError(409, "NOTHING_TO_REPLAY", "None of these videos are in the library any more.");
  return saveSession(childId, child, library, { minutes: earlier.minutes, mode: earlier.mode, leanToward: null, keepOrder: true, rememberMode: false });
}

/** How one video went, and where it stopped. `watched_seconds` only ever grows. */
export async function recordItemOutcome(
  user: AuthUser,
  sessionId: string,
  itemId: string,
  input: { outcome?: "COMPLETED" | "SKIPPED" | "EXITED"; watched_seconds?: number; position_seconds?: number },
) {
  const db = getPool();
  const session = await sessionRow(db, user, sessionId);
  if (session.ended_at) throw new ApiError(409, "SESSION_ENDED", "This session has ended; start a new one.");
  const { rowCount } = await db.query(
    `UPDATE session_items SET
       outcome = COALESCE($3, outcome),
       watched_seconds = CASE WHEN $4::int IS NULL THEN watched_seconds ELSE GREATEST(COALESCE(watched_seconds, 0), $4::int) END,
       position_seconds = COALESCE($5, position_seconds),
       updated_at = now()
     WHERE id = $2 AND session_id = $1`,
    [sessionId, itemId, input.outcome ?? null, input.watched_seconds ?? null, input.position_seconds ?? null],
  );
  if (!rowCount) throw notFound("Session item");
  return (await toSessions(db, [session]))[0];
}

/** Ends the session: the wind-down finished (COMPLETED) or the child left early (EXITED). There's no resume. */
export async function endSession(user: AuthUser, sessionId: string, outcome: "COMPLETED" | "EXITED") {
  const db = getPool();
  const session = await sessionRow(db, user, sessionId);
  if (session.ended_at) throw new ApiError(409, "SESSION_ENDED", "This session has already ended.");
  const ended = (await db.query("UPDATE sessions SET ended_at = now(), outcome = $2 WHERE id = $1 RETURNING *", [sessionId, outcome])).rows[0];
  return (await toSessions(db, [ended]))[0];
}

/** The handoff log: this child's recent sessions, newest first. */
export async function listSessions(user: AuthUser, childId: string) {
  await childRow(user, childId);
  const db = getPool();
  const sessions = (await db.query("SELECT * FROM sessions WHERE child_profile_id = $1 ORDER BY started_at DESC LIMIT $2", [childId, LOG_LENGTH])).rows;
  return { items: await toSessions(db, sessions) };
}
