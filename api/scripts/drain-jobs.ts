// Process every job that is due (ingestion + AI scoring) once, then exit. Used by the daily
// GitHub workflow on QA's free tier (which also prunes old analytics events), where the API's in-process worker only runs while awake.
import { runMigrations } from "../src/db/migrate";
import { closePool, getPool } from "../src/db/pool";
import { pruneAnalyticsEvents } from "../src/services/analytics";
import { drainQueue } from "../src/services/worker";

async function main() {
  await runMigrations(getPool(), () => undefined);
  console.log(`processed ${await drainQueue(2_000)} job(s)`);
  console.log(`pruned ${await pruneAnalyticsEvents(getPool())} analytics event(s) past retention`);
}

main()
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
