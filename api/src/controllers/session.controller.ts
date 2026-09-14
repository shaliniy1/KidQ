import type { Request, Response } from "express";
import { assertChildOwnedBy, setLastUsedSessionChoices } from "../services/child-profile-store";
import { getCurationSettings } from "../services/curation-settings-store";
import { assembleSession } from "../services/session-assembly";
import { resolveTimeBand, TIME_BAND_MODES, type TimeBandMode } from "../services/time-band";
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

  const assembled = await assembleSession({
    childId,
    ageBand: child.ageBand,
    durationMinutes,
    breakIntervalMinutes: settings.breakInterval,
    breakType: settings.breakType,
    contentMixMode: settings.contentMixMode,
    contentMixCategories: settings.contentMixCategories,
    regulationGoals: settings.regulationGoals,
    excludeContentIds: [], // ticket 10 wires in the real per-child exclude list
    timeBand,
  });

  await setLastUsedSessionChoices(childId, durationMinutes, timeBandMode);

  return res.json({ session: assembled });
}
