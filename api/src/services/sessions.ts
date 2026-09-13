// Start a Session (docs/recommendation/parent-experience.md §4–5): builds one sitting's queue from
// the child's parent-approved library, records how each video and the session ended, and serves the
// handoff log. Scoped to the signed-in parent; another family's child or session is a 404.
import { getPool, withTransaction, type Db } from "../db/pool";
import { PRESET_MINUTES, assembleSession, type SessionCandidate } from "../domain/session";
import { recommend } from "../domain/recommendation";
import type { AuthUser } from "../http/auth";
import { ApiError, notFound } from "../http/errors";
import { getActiveRankingConfig } from "../repositories/config";
import { getCardRows, toCard, type ContentCard } from "../repositories/content";
import { childRow, profileOf, toCandidate, toChild } from "./parents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const toIso = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? String(value) : null);
// "Help them calm down" and "Wind down before bed"; no regulation goals means all six.
const CALMING_GOALS = ["calm", "relaxation"];
const LOG_LENGTH = 20;

/** How calm an item is: the mean of its pacing and audio comfort scores. */
function calmOf(card: ContentCard): number | null {
  const parts = (card.content_score?.breakdown ?? []).filter((part) => (part.key === "PACING" || part.key === "AUDIO_COMFORT") && part.score !== null);
  return parts.length ? parts.reduce((sum, part) => sum + (part.score ?? 0), 0) / parts.length : null;
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
  const items = (
    await db.query("SELECT * FROM session_items WHERE session_id = ANY($1) ORDER BY position", [sessions.map((session) => session.id)])
  ).rows;
  const cards = await getCardRows(db, [...new Set(items.map((item) => item.content_item_id as string))], { approvedOnly: false });
  return sessions.map((session) => ({
    id: session.id as string,
    child_id: session.child_profile_id as string,
    minutes: session.minutes as number,
    started_at: toIso(session.started_at) as string,
    ended_at: toIso(session.ended_at),
    outcome: session.outcome ?? null,
    short_by_minutes: session.short_by_minutes as number,
    slots: (session.breaks as string[]).map((breakAfter, index) => ({
      slot: index + 1,
      break_after: breakAfter,
      items: items
        .filter((item) => item.session_id === session.id && item.slot === index + 1)
        .flatMap((item) => {
          const cardRow = cards.get(item.content_item_id);
          if (!cardRow) return [];
          const card = toCard(cardRow);
          // Something unpublished since stays in the log, but can't be played.
          const playable = cardRow.current_status === "APPROVED";
          return [{ id: item.id as string, position: item.position as number, outcome: item.outcome ?? null, watched_seconds: item.watched_seconds ?? null, card: playable ? card : { ...card, player: null } }];
        }),
    })),
  }));
}

/** Builds the session and starts it at once: the child never sees a start button or a timer to change. */
export async function startSession(user: AuthUser, childId: string, requestedMinutes: number) {
  const child = toChild(await childRow(user, childId));
  const db = getPool();
  const libraryIds = (await db.query("SELECT content_item_id FROM library_items WHERE child_profile_id = $1 AND state = 'ADDED'", [childId])).rows.map(
    (row) => row.content_item_id as string,
  );
  const [config, cards] = await Promise.all([getActiveRankingConfig(db), getCardRows(db, libraryIds, { approvedOnly: true })]);
  const rows = [...cards.values()];
  // The parent already chose these, so the child's age and category filters don't apply; ranking only orders them.
  const ranked = recommend(profileOf(child), rows.map(toCandidate), config, new Set(), { limit: Math.max(rows.length, 1), hardFilters: false });
  const library: SessionCandidate[] = ranked.map(({ contentId }) => {
    const row = cards.get(contentId) as Row;
    return { id: contentId, durationSeconds: row.duration_seconds ?? null, category: row.category ?? null, calm: calmOf(toCard(row)) };
  });
  const calmEnding = child.regulation_goals.length === 0 || child.regulation_goals.some((goal) => CALMING_GOALS.includes(goal));
  const assembled = assembleSession(library, requestedMinutes, { breakType: child.break_type, calmEnding });

  const session = await withTransaction(async (client) => {
    const row = (
      await client.query(
        `INSERT INTO sessions (child_profile_id, minutes, breaks, planned_seconds, short_by_minutes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [childId, assembled.minutes, assembled.slots.map((slot) => slot.breakAfter), assembled.plannedSeconds, assembled.shortByMinutes],
      )
    ).rows[0];
    let position = 0;
    for (const slot of assembled.slots) {
      for (const contentItemId of slot.itemIds) {
        position += 1;
        await client.query("INSERT INTO session_items (session_id, content_item_id, slot, position) VALUES ($1, $2, $3, $4)", [row.id, contentItemId, slot.slot, position]);
      }
    }
    // The next Start a Session opens on this length, for this child only.
    if (PRESET_MINUTES.includes(assembled.minutes)) {
      await client.query("UPDATE child_profiles SET session_minutes = $2, updated_at = now() WHERE id = $1", [childId, assembled.minutes]);
    }
    return row;
  });
  return (await toSessions(db, [session]))[0];
}

export async function recordItemOutcome(
  user: AuthUser,
  sessionId: string,
  itemId: string,
  input: { outcome: "COMPLETED" | "SKIPPED" | "EXITED"; watched_seconds?: number },
) {
  const db = getPool();
  const session = await sessionRow(db, user, sessionId);
  if (session.ended_at) throw new ApiError(409, "SESSION_ENDED", "This session has ended; start a new one.");
  const { rowCount } = await db.query(
    "UPDATE session_items SET outcome = $3, watched_seconds = $4, updated_at = now() WHERE id = $2 AND session_id = $1",
    [sessionId, itemId, input.outcome, input.watched_seconds ?? null],
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
