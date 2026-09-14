import type { Request, Response } from "express";
import { assertChildOwnedBy } from "../services/child-profile-store";
import { createSessionLog } from "../services/session-log-store";
import { addNotification } from "../services/inbox-store";
import type { SessionOutcome, WatchedVideoEntry } from "../types/session-log";

const VALID_OUTCOMES: SessionOutcome[] = ["completed", "skipped", "exited"];

function buildThinPoolDisclosure(usedFallback: boolean, fallbackCategory: string | null, ageBand: string): string | null {
  if (!usedFallback) return null;
  const categoryPhrase = fallbackCategory ? ` in ${fallbackCategory}` : "";
  return `A couple of videos today came from a neighboring age range — content was a little thin${categoryPhrase} for ${ageBand} this week.`;
}

/**
 * Called by the child device when a session ends (spec Section 5) — out of
 * scope's Child Player calls this in the real product; the /play/[childId]
 * stub (ticket 07) calls it directly for verification purposes here.
 */
export async function postSessionLog(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const { durationMinutes, watched, outcome, usedFallback, fallbackCategory } = req.body ?? {};

  if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
    return res.status(400).json({ error: "durationMinutes must be a positive number" });
  }
  if (!Array.isArray(watched)) {
    return res.status(400).json({ error: "watched must be an array" });
  }
  if (!VALID_OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: `outcome must be one of ${VALID_OUTCOMES.join(", ")}` });
  }

  const watchedEntries: WatchedVideoEntry[] = watched.map((w: Partial<WatchedVideoEntry>) => ({
    contentId: String(w.contentId ?? ""),
    title: String(w.title ?? ""),
    durationSeconds: Number(w.durationSeconds ?? 0),
  }));

  const log = await createSessionLog(req.identity!.uid, childId, {
    durationMinutes,
    watched: watchedEntries,
    outcome,
    usedFallback: Boolean(usedFallback),
    fallbackCategory: fallbackCategory ?? null,
  });

  const notification = await addNotification(req.identity!.uid, "session_complete", {
    childId,
    durationMinutes: log.durationMinutes,
    watched: watchedEntries.map((w) => ({ title: w.title, durationSeconds: w.durationSeconds })),
    outcome: log.outcome,
    thinPoolDisclosure: buildThinPoolDisclosure(log.usedFallback, log.fallbackCategory, child.ageBand),
  });

  return res.status(201).json({ log, notification });
}
