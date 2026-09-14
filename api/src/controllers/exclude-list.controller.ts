import type { Request, Response } from "express";
import { assertChildOwnedBy } from "../services/child-profile-store";
import { excludeContent, getExcludedContentIds } from "../services/exclude-list-store";

export async function getExcludeList(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const contentIds = await getExcludedContentIds(childId);
  return res.json({ contentIds });
}

/** "Remove from [Child]'s videos" (spec Section 7) — per-child, not per-family. */
export async function postExclude(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const contentId = typeof req.body?.contentId === "string" ? req.body.contentId : "";
  if (!contentId) return res.status(400).json({ error: "contentId is required" });

  const contentIds = await excludeContent(childId, contentId);
  return res.json({ contentIds });
}
