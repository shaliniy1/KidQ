// Parent Analytics (docs/api/README.md "Analytics"): turns a child's plays into the parent page's
// sections. Facts only: nothing here infers mood, attention or development. Pure: no I/O.

export const EVENT_NAMES = [
  "video_started",
  "video_progress",
  "video_paused",
  "video_resumed",
  "video_completed",
  "video_exited",
  "video_replayed",
  "content_clicked",
  "recommendation_clicked",
  "session_started",
  "session_ended",
  "activity_started",
  "activity_completed",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export const RECOMMENDATION_SOURCES = ["PARENT_PLAYLIST", "KIDQ_RECOMMENDATION", "CATEGORY_BROWSE", "CONTINUE_WATCHING", "RECENTLY_WATCHED"] as const;
export const DEVICE_TYPES = ["PHONE", "TABLET", "TV", "DESKTOP"] as const;
export const PERIODS = ["today", "7d", "30d"] as const;
export type Period = (typeof PERIODS)[number];

/** A video counts as finished from 90% watched. */
export const COMPLETED_AT = 90;
const PARTLY_FROM = 25;
/** Allowance for clock jitter between two events of one play. */
export const CLOCK_SLACK_SECONDS = 5;
/** A play can't count for more than its video's length plus 10% (rewinds), or 3 hours when the length is unknown. */
export const MAX_PLAY_SECONDS = 3 * 60 * 60;
// Insights need this much to say anything.
const INSIGHT_MIN_PLAYS = 3;
const INSIGHT_MIN_SECONDS = 10 * 60;
const TOP_CATEGORIES = 5;
const TOP_CONTENT = 5;
const ENGAGED = 3;
const ENGAGED_MIN_PLAYS = 2;

export const PARTS = [
  { key: "MORNING", label: "Morning", hours: "8 AM – 12 PM", from: 8, to: 12 },
  { key: "AFTERNOON", label: "Afternoon", hours: "12 PM – 5 PM", from: 12, to: 17 },
  { key: "EVENING", label: "Evening", hours: "5 PM – 9 PM", from: 17, to: 21 },
  { key: "OTHER", label: "Other times", hours: "Before 8 AM or after 9 PM", from: 0, to: 0 },
] as const;
export type Part = (typeof PARTS)[number]["key"];

export function partOfDay(hour: number): Part {
  return PARTS.find((part) => part.key !== "OTHER" && hour >= part.from && hour < part.to)?.key ?? "OTHER";
}

export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The local calendar day (YYYY-MM-DD) and hour (0–23) of a moment in a time zone. */
export function localParts(at: Date, timeZone: string): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

const PERIOD_DAYS: Record<Period, number> = { today: 1, "7d": 7, "30d": 30 };
const COMPARED_WITH: Record<Period, string> = { today: "yesterday", "7d": "the week before", "30d": "the 30 days before" };
const PERIOD_PHRASE: Record<Period, string> = { today: "today", "7d": "this week", "30d": "over the last 30 days" };

export function periodRange(period: Period, today: string) {
  const length = PERIOD_DAYS[period];
  const start = addDays(today, 1 - length);
  return {
    start,
    end: today,
    previousStart: addDays(start, -length),
    previousEnd: addDays(start, -1),
    days: Array.from({ length }, (_, index) => addDays(start, index)),
  };
}

/**
 * The seconds an event may add to its play: what the app reported, but never more than the wall-clock
 * time since the play's previous event, nor past the play's limit. A stuck or replayed client can't
 * inflate screen time.
 */
export function capActiveSeconds(input: { reported: number; occurredAt: Date; lastEventAt: Date | null; totalSoFar: number; maxTotal: number }): number {
  const elapsed = input.lastEventAt ? Math.max(0, (input.occurredAt.getTime() - input.lastEventAt.getTime()) / 1000) : 0;
  const seconds = Math.min(Math.max(0, input.reported), elapsed + CLOCK_SLACK_SECONDS, Math.max(0, input.maxTotal - input.totalSoFar));
  return Math.round(seconds * 100) / 100;
}

export interface Play {
  itemId: string;
  kind: "VIDEO" | "ACTIVITY";
  category: string | null;
  day: string;
  activeSeconds: number;
  parts: Record<Part, number>;
  maxProgress: number;
  completed: boolean;
}

const minutes = (seconds: number) => Math.round(seconds / 60);
const total = (plays: Play[]) => plays.reduce((sum, play) => sum + play.activeSeconds, 0);
const distinct = (plays: Play[]) => new Set(plays.map((play) => play.itemId)).size;
const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const completionOf = (play: Play) => (play.completed ? 100 : Math.min(100, play.maxProgress));
const OTHER_CATEGORY = "other";

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  return groups;
}

/** Min-max across the compared categories; when they're all equal, each gets full marks (or none if all 0). */
function normalise(value: number, values: number[]): number {
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return max > 0 ? 1 : 0;
  return (value - min) / (max - min);
}

export function summarize(plays: Play[], options: { period: Period; today: string; labels: Record<string, string> }) {
  const range = periodRange(options.period, options.today);
  const within = (from: string, to: string) => plays.filter((play) => play.day >= from && play.day <= to);
  const current = within(range.start, range.end);
  const previous = within(range.previousStart, range.previousEnd);
  const videos = current.filter((play) => play.kind === "VIDEO");
  const activities = current.filter((play) => play.kind === "ACTIVITY");
  const screenSeconds = total(videos);
  const previousScreenSeconds = total(previous.filter((play) => play.kind === "VIDEO"));
  const labelOf = (key: string) =>
    key === OTHER_CATEGORY ? "Other" : (options.labels[key] ?? key.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()));
  const categoryOf = (play: Play) => play.category ?? OTHER_CATEGORY;

  // Time by category: videos and activities together; past the top five it's "Other".
  const byCategory = groupBy(current, categoryOf);
  const allSeconds = total(current);
  const ranked = [...byCategory].map(([key, group]) => ({ key, seconds: total(group) })).filter((entry) => entry.seconds > 0).sort((a, b) => b.seconds - a.seconds);
  const shown = ranked.slice(0, TOP_CATEGORIES);
  const restSeconds = ranked.slice(TOP_CATEGORIES).reduce((sum, entry) => sum + entry.seconds, 0);
  if (restSeconds > 0) {
    const other = shown.find((entry) => entry.key === OTHER_CATEGORY);
    if (other) other.seconds += restSeconds;
    else shown.push({ key: OTHER_CATEGORY, seconds: restSeconds });
  }

  // Engagement: never read from one open. Watch time 40%, completion 30%, repeats 20%, variety 10%.
  const candidates = [...byCategory]
    .filter(([key, group]) => key !== OTHER_CATEGORY && group.length >= ENGAGED_MIN_PLAYS)
    .map(([key, group]) => ({
      key,
      seconds: total(group),
      completion: mean(group.map(completionOf)),
      repeats: group.length - distinct(group),
      items: distinct(group),
      videos: distinct(group.filter((play) => play.kind === "VIDEO")),
      activities: distinct(group.filter((play) => play.kind === "ACTIVITY")),
    }));
  const column = (pick: (entry: (typeof candidates)[number]) => number) => candidates.map(pick);
  const engaged = candidates
    .map((entry) => ({
      entry,
      score:
        0.4 * normalise(entry.seconds, column((c) => c.seconds)) +
        0.3 * normalise(entry.completion, column((c) => c.completion)) +
        0.2 * normalise(entry.repeats, column((c) => c.repeats)) +
        0.1 * normalise(entry.items, column((c) => c.items)),
    }))
    .sort((a, b) => b.score - a.score || b.entry.seconds - a.entry.seconds)
    .slice(0, ENGAGED)
    .map(({ entry }) => ({
      key: entry.key,
      label: labelOf(entry.key),
      minutes: minutes(entry.seconds),
      videos: entry.videos,
      activities: entry.activities,
      average_completion: Math.round(entry.completion),
    }));

  const top = [...groupBy(videos, (play) => play.itemId)]
    .map(([itemId, group]) => ({ item_id: itemId, seconds: total(group), completion: Math.round(mean(group.map(completionOf))), times_watched: group.length }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, TOP_CONTENT)
    .map(({ seconds, ...rest }) => ({ ...rest, minutes: minutes(seconds) }));

  const completed = videos.filter((play) => play.completed).length;
  const completion = {
    started: videos.length,
    completed,
    partly_watched: videos.filter((play) => !play.completed && play.maxProgress >= PARTLY_FROM).length,
    stopped_early: videos.filter((play) => !play.completed && play.maxProgress < PARTLY_FROM).length,
  };
  const partSeconds = (group: Play[], part: Part) => group.reduce((sum, play) => sum + play.parts[part], 0);
  const activitySeconds = total(activities);

  const insights: string[] = [];
  if (current.length >= INSIGHT_MIN_PLAYS && allSeconds >= INSIGHT_MIN_SECONDS) {
    if (engaged[0]) insights.push(`Seems to be engaging most with ${engaged[0].label} ${PERIOD_PHRASE[options.period]}.`);
    if (completion.started >= INSIGHT_MIN_PLAYS) insights.push(`Finished ${completed} of the ${completion.started} videos they started.`);
    const previousByCategory = groupBy(previous, categoryOf);
    const rise = [...byCategory]
      .filter(([key]) => key !== OTHER_CATEGORY && previousByCategory.has(key))
      .map(([key, group]) => ({ key, gain: total(group) - total(previousByCategory.get(key) ?? []) }))
      .sort((a, b) => b.gain - a.gain)[0];
    if (rise && rise.gain >= INSIGHT_MIN_SECONDS) insights.push(`${labelOf(rise.key)} went up compared with ${COMPARED_WITH[options.period]}.`);
    const lead = ranked.find((entry) => entry.key !== OTHER_CATEGORY);
    if (lead) {
      const group = byCategory.get(lead.key) ?? [];
      const busiest = PARTS.filter((part) => part.key !== "OTHER").sort((a, b) => partSeconds(group, b.key) - partSeconds(group, a.key))[0];
      if (partSeconds(group, busiest.key) * 2 >= lead.seconds) insights.push(`Most ${labelOf(lead.key)} time was in the ${busiest.label.toLowerCase()}.`);
    }
  }

  return {
    range: { start: range.start, end: range.end },
    has_data: current.length > 0,
    overview: {
      screen_minutes: minutes(screenSeconds),
      videos_watched: distinct(videos.filter((play) => play.activeSeconds > 0)),
      activities_completed: activities.filter((play) => play.completed).length,
      vs_previous:
        screenSeconds > 0 && previousScreenSeconds > 0
          ? { minutes_diff: minutes(screenSeconds) - minutes(previousScreenSeconds), compared_with: COMPARED_WITH[options.period] }
          : null,
    },
    daily: range.days.map((day) => ({ date: day, minutes: minutes(total(videos.filter((play) => play.day === day))) })),
    categories: shown.map((entry) => ({ key: entry.key, label: labelOf(entry.key), minutes: minutes(entry.seconds), percent: percent(entry.seconds, allSeconds) })),
    engaged,
    top,
    completion,
    pattern: PARTS.map((part) => ({ part: part.key, label: part.label, hours: part.hours, minutes: minutes(partSeconds(videos, part.key)) })),
    split: {
      video_minutes: minutes(screenSeconds),
      activity_minutes: minutes(activitySeconds),
      video_percent: percent(screenSeconds, screenSeconds + activitySeconds),
      activity_percent: activitySeconds > 0 ? 100 - percent(screenSeconds, screenSeconds + activitySeconds) : 0,
    },
    insights: insights.slice(0, 2),
  };
}
