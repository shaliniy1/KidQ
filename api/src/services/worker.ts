// Job worker: claims one job at a time from the outbox queue and runs it. Runs inside the
// API process on Render free (RUN_WORKER_IN_PROCESS) or as its own service in prod.
import { env } from "../config/env";
import { HttpError, redactText } from "../connectors/http";
import type { DiscoveryHints } from "../connectors/types";
import { getPool, withTransaction } from "../db/pool";
import { claimNextJob, completeJob, deferJob, failJob, MAX_ATTEMPTS, recoverStaleJobs, type Job } from "../repositories/jobs";
import { analyzeItem } from "./analysis";
import { verifyAvailability } from "./availability";
import { executeIngestionRun } from "./ingestion";
import { rescoreItem } from "./scoring";

const IDLE_MS = env.nodeEnv === "test" ? 10 : 5_000;
const RECOVER_EVERY_MS = 60_000;

type Handled = { deferUntil: Date; reason: string } | void;

export async function runJob(job: Job): Promise<Handled> {
  switch (job.type) {
    case "INGEST_SEARCH":
    case "INGEST_URLS":
      await executeIngestionRun(job.aggregateId);
      return;
    case "ANALYZE": {
      const result = await analyzeItem(job.aggregateId, {
        hints: job.payload.hints as DiscoveryHints | undefined,
        force: job.payload.force === true,
      });
      if (result.status === "DEFERRED") return { deferUntil: result.retryAt, reason: result.reason };
      return;
    }
    case "RESCORE_ALL": {
      const { rows } = await getPool().query<{ id: string }>("SELECT id FROM content_items");
      for (const { id } of rows) await withTransaction((client) => rescoreItem(client, id));
      return;
    }
    case "VERIFY_AVAILABILITY":
      await verifyAvailability(job.aggregateId);
      return;
  }
}

/** Processes jobs until the queue is empty. Used by tests and the seed script. */
export async function drainQueue(maxJobs = 1_000): Promise<number> {
  let processed = 0;
  while (processed < maxJobs) {
    const job = await claimNextJob(getPool());
    if (!job) break;
    await processJob(job);
    processed += 1;
  }
  return processed;
}

async function processJob(job: Job, log: (message: string) => void = () => undefined) {
  const pool = getPool();
  try {
    const outcome = await runJob(job);
    if (outcome) {
      await deferJob(pool, job.id, outcome.deferUntil, outcome.reason);
      log(`deferred ${job.type} ${job.aggregateId} until ${outcome.deferUntil.toISOString()}`);
    } else {
      await completeJob(pool, job.id);
      log(`done ${job.type} ${job.aggregateId}`);
    }
  } catch (error) {
    if (job.type === "ANALYZE") {
      console.error("[diag] typeof:", typeof error, "instanceof Error:", error instanceof Error);
      console.error("[diag] keys:", error && typeof error === "object" ? Object.keys(error) : null);
      console.error("[diag] stack:", error && typeof error === "object" ? (error as { stack?: unknown }).stack : undefined);
      console.error("[diag] raw:", error);
    }
    const retryable = error instanceof HttpError ? error.retryable : true;
    await failJob(pool, job, error, retryable);
    const finalFailure = !retryable || job.attemptCount >= MAX_ATTEMPTS;
    if (job.type === "ANALYZE" && finalFailure) {
      await pool.query("UPDATE content_items SET analysis_status = 'FAILED', updated_at = now() WHERE id = $1", [job.aggregateId]);
    }
    log(`failed ${job.type} ${job.aggregateId}: ${redactText(error instanceof Error ? error.message : String(error))}`);
  }
}

export function startWorker(log: (message: string) => void = (message) => console.log(`[worker] ${message}`)) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let lastRecovery = 0;

  const schedule = (ms: number) => {
    if (!stopped) timer = setTimeout(tick, ms);
  };

  async function tick() {
    try {
      if (Date.now() - lastRecovery > RECOVER_EVERY_MS) {
        lastRecovery = Date.now();
        const recovered = await recoverStaleJobs(getPool());
        if (recovered) log(`requeued ${recovered} stale job(s)`);
      }
      const job = await claimNextJob(getPool());
      if (!job) return schedule(IDLE_MS);
      await processJob(job, log);
      schedule(0);
    } catch (error) {
      log(`loop error: ${redactText(error instanceof Error ? error.message : String(error))}`);
      schedule(IDLE_MS);
    }
  }

  schedule(0);
  log("started");
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
