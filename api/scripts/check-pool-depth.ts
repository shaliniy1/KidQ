/**
 * Runs the content pool-depth monitor (ticket 14) and prints a report.
 * No scheduler/cron infrastructure exists in this repo yet, so this is
 * the phase-1 "how a content/admin team actually runs the check" —
 * run manually or wire into whatever cron/CI the team already has.
 *
 * Usage: npx tsx scripts/check-pool-depth.ts [threshold]
 */
import { checkAndFlagThinPools, DEFAULT_THIN_THRESHOLD } from "../src/services/content-pool-monitor";

async function main() {
  const threshold = Number(process.argv[2]) || DEFAULT_THIN_THRESHOLD;
  const report = await checkAndFlagThinPools(threshold);

  console.log(`Pool-depth report (threshold=${threshold}, generated ${report.generatedAt})`);
  console.log(`${report.thinCombinations.length} of ${report.entries.length} combinations are thin.\n`);

  for (const entry of report.thinCombinations) {
    console.log(`  ${entry.ageBand.padEnd(4)} ${entry.category.padEnd(28)} count=${entry.count}`);
  }
}

main();
