import type { Request, Response } from "express";
import { assertChildOwnedBy } from "../services/child-profile-store";
import { buildAnalyticsSummary } from "../services/analytics";
import type { TimeRange } from "../types/analytics";

const VALID_RANGES: TimeRange[] = ["day", "week", "month"];

export async function getAnalyticsSummary(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const rangeRaw = req.query.range;
  const range: TimeRange = VALID_RANGES.includes(rangeRaw as TimeRange) ? (rangeRaw as TimeRange) : "week";

  const summary = await buildAnalyticsSummary(req.identity!.uid, childId, range);
  return res.json({ summary });
}
