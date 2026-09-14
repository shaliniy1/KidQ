// Parent Analytics: records a child's viewing events (deduplicated, with screen time capped to what
// was really on screen) into the per-play rollup, and serves the analytics page. Family-scoped: another
// parent's child is a 404.
import { getPool, withTransaction, type Db } from "../db/pool";
import {
  MAX_PLAY_SECONDS,
  capActiveSeconds,
  localParts,
  partOfDay,
  periodRange,
  summarize,
  type EventName,
  type Part,
  type Period,
  type Play,
} from "../domain/analytics";
import type { AuthUser } from "../http/auth";
import type { AnalyticsEventBody } from "../http/schemas";
import { getCardRows, toCard } from "../repositories/content";
import { groupOf, parentCategoriesFrom } from "../domain/parent-categories";
import { listTaxonomy } from "../repositories/taxonomy";
import { childRow } from "./parents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
/** Every field any event can carry; the schema decides which one does. */
type FlatEvent = { event_name: EventName; client_event_id: string; occurred_at: string } & Partial<{
  session_id: string;
  play_id: string;
  content_id: string;
  activity_id: string;
  active_seconds: number;
  position_seconds: number;
  progress_percent: number;
  pause_duration_seconds: number;
  position: number;
  recommendation_source: string;
  recommendation_reason: string;
  device_type: string;
}>;
/** Events older than this (a long-offline device) are ignored rather than rewriting past days. */
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FUTURE_SLACK_MS = 60 * 1000;
const RETENTION = "13 months";
const PART_COLUMNS: Record<Part, string> = { MORNING: "morning_seconds", AFTERNOON: "afternoon_seconds", EVENING: "evening_seconds", OTHER: "other_seconds" };
const COMPLETING: EventName[] = ["video_completed", "activity_completed"];

async function timezoneOf(db: Db, user: AuthUser): Promise<string> {
  return (await db.query("SELECT timezone FROM parent_profiles WHERE parent_user_id = $1", [user.id])).rows[0]?.timezone ?? "UTC";
}

async function itemsById(db: Db, sql: string, ids: string[]): Promise<Map<string, Row>> {
  if (ids.length === 0) return new Map();
  return new Map((await db.query(sql, [ids])).rows.map((row) => [row.id as string, row]));
}

export async function recordEvents(user: AuthUser, childId: string, events: AnalyticsEventBody[]) {
  await childRow(user, childId);
  const db = getPool();
  const timeZone = await timezoneOf(db, user);
  const flat = (events as FlatEvent[]).slice().sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
  const ids = (key: "content_id" | "activity_id") => [...new Set(flat.flatMap((event) => (event[key] ? [event[key]] : [])))];
  const [contents, activities] = await Promise.all([
    itemsById(db, "SELECT id, category, duration_seconds FROM content_items WHERE id = ANY($1)", ids("content_id")),
    itemsById(db, "SELECT id, activity_type AS category, duration_seconds FROM activities WHERE id = ANY($1)", ids("activity_id")),
  ]);
  const counts = { accepted: 0, duplicates: 0, ignored: 0 };
  const now = Date.now();

  await withTransaction(async (client) => {
    for (const event of flat) {
      const occurredAt = new Date(Math.min(Date.parse(event.occurred_at), now + FUTURE_SLACK_MS));
      const item = event.content_id ? contents.get(event.content_id) : event.activity_id ? activities.get(event.activity_id) : null;
      if (now - occurredAt.getTime() > MAX_EVENT_AGE_MS || ((event.content_id || event.activity_id) && !item)) {
        counts.ignored += 1;
        continue;
      }
      const play: Row | undefined = event.play_id ? (await client.query("SELECT * FROM child_plays WHERE play_id = $1 FOR UPDATE", [event.play_id])).rows[0] : undefined;
      // A play belongs to one child and one item; an event claiming otherwise is dropped.
      if (play && (play.child_profile_id !== childId || play.item_id !== item?.id)) {
        counts.ignored += 1;
        continue;
      }
      const duration: number | null = item?.duration_seconds ?? null;
      const active =
        event.play_id && event.active_seconds !== undefined
          ? capActiveSeconds({
              reported: event.active_seconds,
              occurredAt,
              lastEventAt: play ? new Date(play.last_event_at) : null,
              totalSoFar: play?.active_seconds ?? 0,
              maxTotal: duration ? duration * 1.1 : MAX_PLAY_SECONDS,
            })
          : 0;
      const metadata = Object.fromEntries(
        Object.entries({
          pause_duration_seconds: event.pause_duration_seconds,
          list_position: event.position,
          recommendation_reason: event.recommendation_reason,
        }).filter(([, value]) => value !== undefined),
      );
      const inserted = await client.query(
        `INSERT INTO analytics_events (child_profile_id, client_event_id, event_name, play_id, content_item_id, activity_id, session_id, category,
           active_seconds, position_seconds, progress_percent, recommendation_source, device_type, metadata, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (child_profile_id, client_event_id) DO NOTHING RETURNING id`,
        [
          childId,
          event.client_event_id,
          event.event_name,
          event.play_id ?? null,
          event.content_id ?? null,
          event.activity_id ?? null,
          event.session_id ?? null,
          item?.category ?? null,
          active,
          event.position_seconds ?? null,
          event.progress_percent ?? null,
          event.recommendation_source ?? null,
          event.device_type ?? null,
          metadata,
          occurredAt,
        ],
      );
      if (!inserted.rowCount) {
        counts.duplicates += 1;
        continue;
      }
      counts.accepted += 1;
      if (!event.play_id || !item) continue;

      const { day, hour } = localParts(occurredAt, timeZone);
      if (!play) {
        await client.query(
          `INSERT INTO child_plays (play_id, child_profile_id, kind, item_id, category, day, duration_seconds, started_at, last_event_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
          [event.play_id, childId, event.activity_id ? "ACTIVITY" : "VIDEO", item.id, item.category ?? null, day, duration, occurredAt],
        );
      }
      const completes = COMPLETING.includes(event.event_name);
      const progress = event.event_name === "activity_completed" ? 100 : (event.progress_percent ?? 0);
      const part = PART_COLUMNS[partOfDay(hour)];
      await client.query(
        `UPDATE child_plays SET active_seconds = active_seconds + $2, ${part} = ${part} + $2,
           max_progress = GREATEST(max_progress, $3), completed = completed OR $4, last_event_at = GREATEST(last_event_at, $5)
         WHERE play_id = $1`,
        [event.play_id, active, progress, completes, occurredAt],
      );
    }
  });
  return counts;
}

export async function getAnalytics(user: AuthUser, childId: string, period: Period) {
  await childRow(user, childId);
  const db = getPool();
  const timezone = await timezoneOf(db, user);
  const today = localParts(new Date(), timezone).day;
  const range = periodRange(period, today);
  const [rows, taxonomy] = await Promise.all([
    db.query("SELECT *, to_char(day, 'YYYY-MM-DD') AS local_day FROM child_plays WHERE child_profile_id = $1 AND day BETWEEN $2 AND $3", [
      childId,
      range.previousStart,
      range.end,
    ]),
    listTaxonomy(db),
  ]);
  // Parents see the seven parent categories, so each play's admin category rolls up to its group.
  const groups = parentCategoriesFrom(taxonomy.parent_category);
  const plays: Play[] = rows.rows.map((row) => ({
    itemId: row.item_id,
    kind: row.kind,
    category: groupOf(groups, row.category) ?? row.category,
    day: row.local_day,
    activeSeconds: row.active_seconds,
    parts: { MORNING: row.morning_seconds, AFTERNOON: row.afternoon_seconds, EVENING: row.evening_seconds, OTHER: row.other_seconds },
    maxProgress: row.max_progress,
    completed: row.completed,
  }));
  const { top, ...summary } = summarize(plays, { period, today, labels: Object.fromEntries([...taxonomy.category, ...taxonomy.parent_category].map((term) => [term.key, term.label])) });
  const cards = await getCardRows(db, top.map((entry) => entry.item_id), { approvedOnly: false });
  return {
    child_id: childId,
    period,
    timezone,
    ...summary,
    // History, not a playlist: the page never plays from here.
    top_content: top.flatMap(({ item_id: itemId, ...stats }) => {
      const row = cards.get(itemId);
      return row ? [{ card: { ...toCard(row), player: null }, ...stats }] : [];
    }),
  };
}

/** Raw events are kept 13 months; the per-play rollup the page reads stays. Run by the daily job drain. */
export async function pruneAnalyticsEvents(db: Db): Promise<number> {
  return (await db.query(`DELETE FROM analytics_events WHERE occurred_at < now() - interval '${RETENTION}'`)).rowCount ?? 0;
}
