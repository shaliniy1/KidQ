// Standalone worker entrypoint (`npm run start:worker`) for when the API and worker run as
// separate services (prod). On Render free the API starts the same worker in-process.
import { env } from "./config/env";
import { runMigrations } from "./db/migrate";
import { closePool, getPool } from "./db/pool";
import { startWorker } from "./services/worker";

async function main() {
  if (env.runMigrationsOnBoot) await runMigrations(getPool());
  const worker = startWorker();
  const shutdown = () => {
    worker.stop();
    void closePool().finally(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error: Error) => {
  console.error(`[worker] failed to start: ${error.message}`);
  process.exit(1);
});
