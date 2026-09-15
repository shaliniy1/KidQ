import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ParentExperienceConfig } from "../types/parent-config";

// Resolved relative to the running process, same convention as
// content-store.ts's KIDQ_DATA_DIR — lets ops point at a different config
// location without a rebuild if ever needed.
const configPath = path.resolve(
  process.env.KIDQ_PARENT_CONFIG_PATH || path.join("config", "parent-experience.json")
);

/**
 * Reads the parent-experience config fresh from disk on every call. Config
 * changes here (categories, age-band defaults) take effect on the next
 * request — no app rebuild or redeploy required. This file is small and
 * read infrequently enough that no in-memory cache is needed; if that
 * changes, add a cache invalidated by the file's mtime rather than a fixed
 * TTL, so an edit is never silently stale.
 */
export async function getParentExperienceConfig(): Promise<ParentExperienceConfig> {
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw) as ParentExperienceConfig;
}
