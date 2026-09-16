// Database-backed job queue on outbox_events (scoring MD §23: "a simple database-backed job
// queue is enough"). Jobs survive restarts and Render free-tier sleep; workers claim with
// FOR UPDATE SKIP LOCKED so several processes never run the same job.
import type { Db } from "../db/pool";
import { redactText } from "../connectors/http";

export type JobType = "INGEST_URLS" | "INGEST_SEARCH" | "ANALYZE" | "RESCORE_ALL" | "VERIFY_AVAILABILITY";

export interface Job {
  id: string;
  type: JobType;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  priority: number;
}

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";
export const MAX_ATTEMPTS = 5;

export async function enqueueJob(
  db: Db,
  job: {
    type: JobType;
    aggregateType: string;
    aggregateId: string;
    payload?: Record<string, unknown>;
    priority?: number;
    dedupeKey?: string;
    availableAt?: Date;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, priority, dedupe_key, available_at)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('PENDING', 'PROCESSING') DO NOTHING`,
    [
      job.aggregateType,
      job.aggregateId,
      job.type,
      JSON.stringify(job.payload ?? {}),
      job.priority ?? 0,
      job.dedupeKey ?? null,
      job.availableAt ?? null,
    ],
  );
}

export async function claimNextJob(db: Db): Promise<Job | null> {
  const { rows } = await db.query(
    `UPDATE outbox_events SET status = 'PROCESSING', locked_at = now(), attempt_count = attempt_count + 1
     WHERE id = (
       SELECT id FROM outbox_events
       WHERE status = 'PENDING' AND available_at <= now()
       ORDER BY priority DESC, available_at, created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING id, event_type, aggregate_type, aggregate_id, payload, attempt_count, priority`,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    type: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: row.payload ?? {},
    attemptCount: row.attempt_count,
    priority: row.priority,
  };
}

export async function completeJob(db: Db, id: string): Promise<void> {
  await db.query("UPDATE outbox_events SET status = 'SUCCEEDED', processed_at = now(), last_error = NULL WHERE id = $1", [id]);
}

/** Retryable failures back off exponentially (1, 2, 4, 8… minutes); others, or too many attempts, fail for good. */
export async function failJob(db: Db, job: Job, error: unknown, retryable: boolean): Promise<void> {
  const message = redactText(error instanceof Error ? (error.stack ?? error.message) : String(error)).slice(0, 2000);
  if (retryable && job.attemptCount < MAX_ATTEMPTS) {
    await db.query(
      `UPDATE outbox_events SET status = 'PENDING', locked_at = NULL, last_error = $2,
         available_at = now() + make_interval(mins => $3) WHERE id = $1`,
      [job.id, message, 2 ** (job.attemptCount - 1)],
    );
    return;
  }
  await db.query("UPDATE outbox_events SET status = 'FAILED', processed_at = now(), last_error = $2 WHERE id = $1", [job.id, message]);
}

/** Postpone without using up an attempt (e.g. the AI daily quota is spent). */
export async function deferJob(db: Db, id: string, until: Date, reason: string): Promise<void> {
  await db.query(
    `UPDATE outbox_events SET status = 'PENDING', locked_at = NULL, available_at = $2,
       attempt_count = GREATEST(attempt_count - 1, 0), last_error = $3 WHERE id = $1`,
    [id, until, reason],
  );
}

/** Jobs left PROCESSING by a crashed or slept worker go back to the queue. */
export async function recoverStaleJobs(db: Db, olderThanMinutes = 15): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE outbox_events SET status = 'PENDING', locked_at = NULL
     WHERE status = 'PROCESSING' AND locked_at < now() - make_interval(mins => $1)`,
    [olderThanMinutes],
  );
  return rowCount ?? 0;
}
