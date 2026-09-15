import { createApp } from "./app";
import { env } from "./config/env";
import { runMigrations } from "./db/migrate";
import { closePool, getPool } from "./db/pool";
import { startWorker } from "./services/worker";

async function main() {
  // Render free has no pre-deploy step, so QA migrates at boot (advisory-locked, idempotent).
  if (env.runMigrationsOnBoot) await runMigrations(getPool());

  const server = createApp().listen(env.port, () => {
    console.log(`kidq-api listening on port ${env.port}`);
  });
  // Render free has no background workers: run the job worker inside the API process.
  const worker = env.runWorkerInProcess ? startWorker() : null;

  const shutdown = () => {
    worker?.stop();
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error: Error) => {
  console.error(`kidq-api failed to start: ${error.message}`);
  process.exit(1);
});
