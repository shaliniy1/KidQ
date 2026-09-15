import { createJsonFileStore } from "../lib/json-file-store";
import type { ChildExcludeList } from "../types/exclude-list";

const excludeLists = createJsonFileStore<ChildExcludeList>("exclude-lists.json");

/**
 * Per-child, not per-family (spec Section 7) — excluding a video for one
 * sibling never affects another. Checked by Session Assembly (ticket 07)
 * before filling any slot.
 */
export async function getExcludedContentIds(childId: string): Promise<string[]> {
  const all = await excludeLists.readAll();
  return all[childId]?.contentIds ?? [];
}

export async function excludeContent(childId: string, contentId: string): Promise<string[]> {
  let result: string[] = [];
  await excludeLists.write((all) => {
    const existing = all[childId]?.contentIds ?? [];
    if (existing.includes(contentId)) {
      result = existing;
      return;
    }
    result = [...existing, contentId];
    all[childId] = { childId, contentIds: result };
  });
  return result;
}
