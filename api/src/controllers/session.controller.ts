import type { Request, Response } from "express";
import { assertChildOwnedBy, setLastUsedSessionChoices } from "../services/child-profile-store";
import { getCurationSettings } from "../services/curation-settings-store";
import { assembleSession } from "../services/session-assembly";
import { resolveTimeBand, TIME_BAND_MODES, type TimeBandMode } from "../services/time-band";
import { getExcludedContentIds } from "../services/exclude-list-store";
import { isOutsideSchedule } from "../services/daily-schedule";
import { markQueued, acknowledge, getSyncStatus } from "../services/device-sync-store";
import { DURATION_OPTIONS } from "../types/curation-settings";

export async function postStartSession(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const durationMinutes = req.body?.durationMinutes;
  if (!DURATION_OPTIONS.includes(durationMinutes)) {
    return res.status(400).json({ error: `durationMinutes must be one of ${DURATION_OPTIONS.join(", ")}` });
  }

  const modeRaw = req.body?.timeBandMode;
  const timeBandMode: TimeBandMode = TIME_BAND_MODES.includes(modeRaw) ? modeRaw : "auto";

  const settings = await getCurationSettings(childId);
  const timeBand = resolveTimeBand(timeBandMode);
  const excludeContentIds = await getExcludedContentIds(childId);

  const assembled = await assembleSession({
    childId,
    ageBand: child.ageBand,
    durationMinutes,
    breakIntervalMinutes: settings.breakInterval,
    breakType: settings.breakType,
    contentMixMode: settings.contentMixMode,
    contentMixCategories: settings.contentMixCategories,
    regulationGoals: settings.regulationGoals,
    excludeContentIds,
    timeBand,
  });

  await setLastUsedSessionChoices(childId, durationMinutes, timeBandMode);
  // The moment a queue is assembled it's "pending" until the child device
  // actually acknowledges receiving it (ticket 15) — this is the "saved"
  // half of "saved vs synced".
  await markQueued(childId, assembled.sessionId);

  return res.json({
    session: assembled,
    // Reminder-only (spec Section 11 #27) — never blocks the session above,
    // just tells the client whether to show the soft terracotta note.
    outsideScheduledWindow: isOutsideSchedule(settings.dailySchedule),
  });
}

/** Called by the child device once it has actually received/loaded the queue. */
export async function postSyncAck(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

  const record = await acknowledge(childId, sessionId);
  if (!record) {
    return res.status(409).json({ error: "No matching pending queue for that sessionId (it may have been superseded)" });
  }
  return res.json({ syncStatus: record });
}

/** No UI consumes this yet — available for a future status indicator (spec Section 9). */
export async function getSyncStatusForChild(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const record = await getSyncStatus(childId);
  return res.json({ syncStatus: record });
}
