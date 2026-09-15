import type { Request, Response } from "express";
import { getParentExperienceConfig } from "../services/parent-config";

export async function getCategories(_req: Request, res: Response) {
  try {
    const config = await getParentExperienceConfig();
    res.json({ categories: config.categories, contentMixDefault: config.contentMixDefault });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load categories" });
  }
}

export async function getAgeBandDefaults(_req: Request, res: Response) {
  try {
    const config = await getParentExperienceConfig();
    res.json({ ageBands: config.ageBands, ageBandDefaults: config.ageBandDefaults });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load age-band defaults" });
  }
}
