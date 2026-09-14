import { listSessionLogs } from "./session-log-store";
import { readAllContent } from "./content-store";
import { listLibrary } from "./library-store";
import type { AnalyticsSummary, CategoryTime, TimeRange } from "../types/analytics";
import type { SessionLogRecord } from "../types/session-log";
import type { LibraryTag } from "../types/library";

function rangeStartMs(range: TimeRange, now: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  if (range === "day") return now.getTime() - oneDay;
  if (range === "week") return now.getTime() - 7 * oneDay;
  return now.getTime() - 30 * oneDay; // month — a rolling 30-day window, not calendar-aligned (phase-1 simplification)
}

function filterByRange(logs: SessionLogRecord[], range: TimeRange): SessionLogRecord[] {
  const cutoff = rangeStartMs(range, new Date());
  return logs.filter((log) => new Date(log.loggedAt).getTime() >= cutoff);
}

export async function buildAnalyticsSummary(uid: string, childId: string, range: TimeRange): Promise<AnalyticsSummary> {
  const allLogs = await listSessionLogs(uid, childId);
  const logs = filterByRange(allLogs, range);

  const catalog = await readAllContent();
  const categoryByContentId = new Map(catalog.map((record) => [record.content_id, record.category]));

  const library = await listLibrary(uid);
  const tagByContentId = new Map(library.map((entry) => [entry.contentId, entry.tag]));

  let totalScreenTimeSeconds = 0;
  const categorySeconds = new Map<string, number>();
  const sourceSeconds: Record<LibraryTag, number> = {
    kidq_recommended: 0,
    picked_by_parent: 0,
    admin_approved_from_submission: 0,
  };
  let completed = 0;
  let exited = 0;

  for (const log of logs) {
    if (log.outcome === "completed") completed++;
    if (log.outcome === "exited") exited++;

    for (const video of log.watched) {
      totalScreenTimeSeconds += video.durationSeconds;

      const category = categoryByContentId.get(video.contentId) ?? "Uncategorized";
      categorySeconds.set(category, (categorySeconds.get(category) ?? 0) + video.durationSeconds);

      // A watched video not in the family's own library came straight from
      // the admin-approved catalog Session Assembly draws from directly —
      // by definition KidQ-recommended (spec Section 7), not a fallback guess.
      const tag = tagByContentId.get(video.contentId) ?? "kidq_recommended";
      sourceSeconds[tag] += video.durationSeconds;
    }
  }

  const categoryBreakdown: CategoryTime[] = Array.from(categorySeconds.entries())
    .map(([category, seconds]) => ({ category, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  const reviewedSeconds = sourceSeconds.kidq_recommended + sourceSeconds.admin_approved_from_submission;
  const percentKidqReviewed = totalScreenTimeSeconds > 0 ? Math.round((reviewedSeconds / totalScreenTimeSeconds) * 100) : 0;

  return {
    childId,
    range,
    sessionCount: logs.length,
    totalScreenTimeSeconds,
    categoryBreakdown,
    completionRatePercent: logs.length > 0 ? Math.round((completed / logs.length) * 100) : 0,
    earlyExitRatePercent: logs.length > 0 ? Math.round((exited / logs.length) * 100) : 0,
    contentSource: {
      kidqRecommendedSeconds: sourceSeconds.kidq_recommended,
      pickedByParentSeconds: sourceSeconds.picked_by_parent,
      adminApprovedFromSubmissionSeconds: sourceSeconds.admin_approved_from_submission,
      percentKidqReviewed,
    },
  };
}

/**
 * Admin-facing CSV export — one row per watched video across every child on
 * the account, all-time (not range-filtered; offline analysis wants the
 * raw rows, an analyst can pivot by date/range themselves). Note: this app
 * has no separate Admin authentication model, so this endpoint is gated
 * behind the same requireAuth as everything else (the requesting account's
 * own data) rather than a true cross-family Admin role — a phase-1
 * simplification, not a security gap, since it still never exposes another
 * family's data.
 */
export async function buildCsvExport(uid: string, childNicknameById: Map<string, string>): Promise<string> {
  const logs = await listSessionLogs(uid);
  const catalog = await readAllContent();
  const categoryByContentId = new Map(catalog.map((record) => [record.content_id, record.category]));
  const library = await listLibrary(uid);
  const tagByContentId = new Map(library.map((entry) => [entry.contentId, entry.tag]));

  const header = "date,child,title,category,duration_seconds,source_tag,session_outcome\n";
  const rows: string[] = [];
  for (const log of logs) {
    const childName = childNicknameById.get(log.childId) ?? log.childId;
    for (const video of log.watched) {
      const category = categoryByContentId.get(video.contentId) ?? "Uncategorized";
      const tag = tagByContentId.get(video.contentId) ?? "kidq_recommended";
      const escapedTitle = `"${video.title.replace(/"/g, '""')}"`;
      rows.push(
        [log.loggedAt, childName, escapedTitle, category, video.durationSeconds, tag, log.outcome].join(",")
      );
    }
  }
  return header + rows.join("\n") + (rows.length > 0 ? "\n" : "");
}
