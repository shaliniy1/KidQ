import type { Request, Response } from "express";
import { assertChildOwnedBy } from "../services/child-profile-store";
import { getCurationSettings, saveCurationSettings } from "../services/curation-settings-store";
import { getParentExperienceConfig } from "../services/parent-config";
import {
  BREAK_INTERVAL_OPTIONS,
  BREAK_TYPES,
  DURATION_OPTIONS,
  REGULATION_GOAL_TAGS,
  type CurationSettings,
} from "../types/curation-settings";

export async function getSettings(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const settings = await getCurationSettings(childId);
  return res.json({ settings });
}

export async function putSettings(req: Request, res: Response) {
  const childId = req.params.childId;
  const child = await assertChildOwnedBy(childId, req.identity!.uid);
  if (!child) return res.status(404).json({ error: "Child not found" });

  const body = req.body as Partial<CurationSettings>;
  const config = await getParentExperienceConfig();
  const validCategories = new Set(config.categories);

  const interests = Array.isArray(body.interests) ? body.interests : null;
  const contentMixCategories = Array.isArray(body.contentMixCategories) ? body.contentMixCategories : null;
  const regulationGoals = Array.isArray(body.regulationGoals) ? body.regulationGoals : null;

  if (!interests || !interests.every((c) => validCategories.has(c))) {
    return res.status(400).json({ error: "interests must be a subset of the configured category list" });
  }
  if (body.contentMixMode !== "surprise_us" && body.contentMixMode !== "choose_categories") {
    return res.status(400).json({ error: "contentMixMode must be 'surprise_us' or 'choose_categories'" });
  }
  if (!contentMixCategories || !contentMixCategories.every((c) => validCategories.has(c))) {
    return res.status(400).json({ error: "contentMixCategories must be a subset of the configured category list" });
  }
  if (!regulationGoals || !regulationGoals.every((g) => (REGULATION_GOAL_TAGS as readonly string[]).includes(g))) {
    return res.status(400).json({ error: `regulationGoals must be a subset of ${REGULATION_GOAL_TAGS.join(", ")}` });
  }
  if (!DURATION_OPTIONS.includes(body.durationDefault as never)) {
    return res.status(400).json({ error: `durationDefault must be one of ${DURATION_OPTIONS.join(", ")}` });
  }
  if (!BREAK_INTERVAL_OPTIONS.includes(body.breakInterval as never)) {
    return res.status(400).json({ error: `breakInterval must be one of ${BREAK_INTERVAL_OPTIONS.join(", ")}` });
  }
  if (!body.breakType || !BREAK_TYPES.includes(body.breakType)) {
    return res.status(400).json({ error: `breakType must be one of ${BREAK_TYPES.join(", ")}` });
  }

  const saved = await saveCurationSettings(childId, {
    interests,
    contentMixMode: body.contentMixMode,
    contentMixCategories,
    regulationGoals: regulationGoals as CurationSettings["regulationGoals"],
    durationDefault: body.durationDefault as CurationSettings["durationDefault"],
    breakInterval: body.breakInterval as CurationSettings["breakInterval"],
    breakType: body.breakType,
  });

  return res.json({ settings: saved });
}
