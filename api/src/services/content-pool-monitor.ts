import { readAllContent } from "./content-store";
import { getParentExperienceConfig } from "./parent-config";
import { AGE_BANDS } from "../types/parent-config";
import type { PoolDepthEntry, PoolDepthReport } from "../types/pool-depth";
import { createJsonFileStore } from "../lib/json-file-store";

/** Below this many approved videos for an age-band × category combo, the Session 2 Rule 6 fallback is likely to trigger for it. */
export const DEFAULT_THIN_THRESHOLD = 5;

const flagsStore = createJsonFileStore<PoolDepthReport>("pool-depth-flags.json");

/**
 * Computes catalog depth for every age-band × category combination — not
 * just ones with existing content, so a category with ZERO approved
 * videos for a band is surfaced too (exactly what a content team needs to
 * see, not just "thin" ones that already have a few).
 */
export async function computePoolDepth(threshold = DEFAULT_THIN_THRESHOLD): Promise<PoolDepthReport> {
  const [catalog, config] = await Promise.all([readAllContent(), getParentExperienceConfig()]);
  const approved = catalog.filter((record) => record.content_status === "APPROVED");

  const entries: PoolDepthEntry[] = [];
  for (const ageBand of AGE_BANDS) {
    for (const category of config.categories) {
      const count = approved.filter(
        (record) => record.age_band.includes(ageBand) && record.category === category
      ).length;
      entries.push({ ageBand, category, count, isThin: count <= threshold });
    }
  }

  return {
    threshold,
    generatedAt: new Date().toISOString(),
    entries,
    thinCombinations: entries.filter((entry) => entry.isThin),
  };
}

/**
 * "Flags to the content/admin team" (spec) — this phase-1 backend has no
 * paging/Slack integration, so a flag is: logged (console.warn, so it
 * shows up in whatever the API's log aggregation already is) and written
 * to a durable, appendable record so a content team has something to
 * check even if they missed the log line. Not parent/child-facing —
 * nothing here is exposed over the API the parent app calls.
 */
export async function checkAndFlagThinPools(threshold = DEFAULT_THIN_THRESHOLD): Promise<PoolDepthReport> {
  const report = await computePoolDepth(threshold);
  if (report.thinCombinations.length > 0) {
    console.warn(
      `[content-pool-monitor] ${report.thinCombinations.length} thin age-band x category combination(s) at/below threshold ${threshold}:`,
      report.thinCombinations.map((e) => `${e.ageBand}/${e.category}=${e.count}`).join(", ")
    );
  }
  await flagsStore.write((all) => {
    all[report.generatedAt] = report;
  });
  return report;
}
