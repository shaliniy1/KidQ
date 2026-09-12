// Seed the catalogue from config/discovery-plan.json (~270 videos, README discovery topics).
//
//   npm run seed:discover -w api                          # queue one ingestion run per source
//   npm run seed:discover -w api -- --sources=youtube     # only some sources
//   npm run seed:discover -w api -- --drain               # also run the jobs here (fetch + AI scoring)
//
// Without --drain, the API's worker picks the jobs up. Point DATABASE_URL at the target DB (e.g. QA).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SOURCE_SYSTEM_IDS } from "../src/connectors";
import type { DiscoveryQuery, SourceSystemId } from "../src/connectors/types";
import { runMigrations } from "../src/db/migrate";
import { closePool, getPool } from "../src/db/pool";
import { createIngestionRun } from "../src/services/ingestion";
import { drainQueue } from "../src/services/worker";

interface DiscoveryPlan {
  defaults: { language: string; regionCode: string };
  sources: Record<string, DiscoveryQuery[]>;
}

async function main() {
  const args = process.argv.slice(2);
  const drain = args.includes("--drain");
  const only = args.find((arg) => arg.startsWith("--sources="))?.split("=")[1]?.split(",");
  const plan = JSON.parse(await readFile(path.resolve(__dirname, "../../config/discovery-plan.json"), "utf8")) as DiscoveryPlan;
  const sources = (only ?? Object.keys(plan.sources)) as SourceSystemId[];

  const pool = getPool();
  await runMigrations(pool, () => undefined);
  for (const source of sources) {
    if (!SOURCE_SYSTEM_IDS.includes(source)) throw new Error(`Unknown source "${source}". Known: ${SOURCE_SYSTEM_IDS.join(", ")}`);
    const queries = plan.sources[source].map((query) => ({ language: plan.defaults.language, regionCode: plan.defaults.regionCode, ...query }));
    const runId = await createIngestionRun(pool, { sourceSystemId: source, query: { mode: "search", queries }, requestedBy: "seed:discover" });
    console.log(`queued ${source}: ${queries.length} queries (run ${runId})`);
  }

  if (drain) {
    console.log("running jobs here (AI scoring may pause at the free-tier daily limit)…");
    console.log(`processed ${await drainQueue(10_000)} jobs`);
  }

  const { rows } = await pool.query(
    "SELECT source, studio_state, count(*)::int AS n FROM content_records_v GROUP BY source, studio_state ORDER BY source, studio_state",
  );
  console.table(rows);
}

main()
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
