// Ingestion runs (README "Connector result contract" + "Database write transaction").
// A run is created first (202 Accepted), executed by the worker, and every source item is
// written in its own transaction so one bad item never loses the rest (PARTIAL run).
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { getConnector } from "../connectors";
import { redactText } from "../connectors/http";
import type { ConnectorBatch, DiscoveryHints, DiscoveryQuery, ItemError, NormalizedRecord, RightsEvidence, SourceSystemId } from "../connectors/types";
import { fetchYouTubeVideos, parseYouTubeId } from "../connectors/youtube";
import { getPool, withTransaction, type Db } from "../db/pool";
import { enqueueJob } from "../repositories/jobs";

export type IngestionQuery =
  | { mode: "search"; queries: DiscoveryQuery[]; priority?: number }
  | { mode: "urls"; urls: string[]; hints?: DiscoveryHints; priority?: number };

type UpsertResult = "created" | "updated" | "unchanged";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Change detector: only fields that matter to KidQ, not volatile API fields like etags. */
export function metadataHash(record: NormalizedRecord): string {
  const relevant = {
    title: record.title,
    description: record.description,
    creator: record.creator,
    durationSeconds: record.durationSeconds,
    thumbnails: record.thumbnails,
    embeddable: record.embeddable,
    madeForKids: record.madeForKids,
    captionAvailable: record.captionAvailable,
    mediaUrl: record.mediaUrl,
    language: record.language,
    tags: record.tags,
    license: record.rights.licenseName,
    story: record.story ?? null,
  };
  return crypto.createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

export async function createIngestionRun(
  db: Db,
  input: { sourceSystemId: SourceSystemId; query: IngestionQuery; requestedBy: string },
): Promise<string> {
  const connector = getConnector(input.sourceSystemId);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO ingestion_runs (source_system_id, query, status, connector_version, requested_by)
     VALUES ($1, $2, 'QUEUED', $3, $4) RETURNING id`,
    [input.sourceSystemId, JSON.stringify(input.query), connector.version, input.requestedBy],
  );
  const runId = rows[0].id;
  await enqueueJob(db, {
    type: input.query.mode === "urls" ? "INGEST_URLS" : "INGEST_SEARCH",
    aggregateType: "ingestion_run",
    aggregateId: runId,
    priority: input.query.priority ?? 0,
    dedupeKey: `ingest:${runId}`,
  });
  return runId;
}

/** Hands each batch to `onBatch` as soon as it arrives, so items are stored while the run is still going. */
async function forEachBatch(sourceSystemId: SourceSystemId, query: IngestionQuery, onBatch: (batch: ConnectorBatch) => Promise<void>) {
  if (query.mode === "urls") {
    // URL import covers YouTube in the MVP; NASA and Wikimedia arrive through discovery queries.
    const invalid: ItemError[] = [];
    const ids: string[] = [];
    for (const url of query.urls) {
      const id = parseYouTubeId(url);
      if (id) ids.push(id);
      else invalid.push({ externalId: null, code: "INVALID_URL", message: `Not a YouTube video URL: ${url.slice(0, 200)}`, retryable: false });
    }
    const batch = ids.length ? await fetchYouTubeVideos(ids, query.hints ?? {}) : { records: [], rejected: 0, seen: 0, errors: [] };
    await onBatch({ ...batch, seen: batch.seen + invalid.length, errors: [...invalid, ...batch.errors] });
    return;
  }
  const connector = getConnector(sourceSystemId);
  // Sequential per source keeps us inside each API's rate limits.
  for (const discoveryQuery of query.queries) {
    let batch: ConnectorBatch;
    try {
      batch = await connector.discover(discoveryQuery);
    } catch (error) {
      batch = { records: [], rejected: 0, seen: 0, errors: [{ externalId: null, code: "QUERY_FAILED", message: `"${discoveryQuery.query}": ${message(error)}`, retryable: true }] };
    }
    await onBatch(batch);
  }
}

export async function executeIngestionRun(runId: string) {
  const pool = getPool();
  const run = (
    await pool.query("UPDATE ingestion_runs SET status = 'RUNNING', started_at = now() WHERE id = $1 RETURNING source_system_id, query", [runId])
  ).rows[0];
  if (!run) throw new Error(`Ingestion run ${runId} not found`);
  const query = run.query as IngestionQuery;
  const counts: Record<UpsertResult | "seen" | "rejected", number> = { seen: 0, created: 0, updated: 0, unchanged: 0, rejected: 0 };
  const errors: ItemError[] = [];
  let fatal: string | null = null;

  try {
    await forEachBatch(run.source_system_id, query, async (batch) => {
      counts.seen += batch.seen;
      counts.rejected += batch.rejected;
      errors.push(...batch.errors);
      for (const record of batch.records) {
        try {
          const outcome = await upsertRecord(record, runId, query.priority ?? 0);
          counts[outcome.result] += 1;
        } catch (error) {
          errors.push({ externalId: record.externalId, code: "STORE_FAILED", message: message(error), retryable: true });
        }
      }
      // Live progress for the admin "Add content" page.
      await pool.query(
        `UPDATE ingestion_runs SET records_seen = $2, records_created = $3, records_updated = $4, records_unchanged = $5,
           records_rejected_before_ai = $6 WHERE id = $1`,
        [runId, counts.seen, counts.created, counts.updated, counts.unchanged, counts.rejected],
      );
    });
  } catch (error) {
    fatal = message(error);
    errors.push({ externalId: null, code: "RUN_FAILED", message: fatal, retryable: true });
  }

  const stored = counts.created + counts.updated + counts.unchanged;
  const realErrors = errors.filter((error) => !error.code.startsWith("REJECTED_"));
  const status = fatal && stored === 0 ? "FAILED" : realErrors.length > 0 ? "PARTIAL" : "SUCCEEDED";

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE ingestion_runs SET status = $2, records_seen = $3, records_created = $4, records_updated = $5,
         records_unchanged = $6, records_rejected_before_ai = $7, error_summary = $8, finished_at = now()
       WHERE id = $1`,
      [runId, status, counts.seen, counts.created, counts.updated, counts.unchanged, counts.rejected, fatal ? redactText(fatal).slice(0, 500) : null],
    );
    for (const error of errors) {
      await client.query(
        `INSERT INTO ingestion_errors (ingestion_run_id, external_id, error_code, redacted_message, retryable)
         VALUES ($1, $2, $3, $4, $5)`,
        [runId, error.externalId, error.code, redactText(error.message).slice(0, 1000), error.retryable],
      );
    }
  });
  return { status, ...counts };
}

function transcriptStatus(record: NormalizedRecord): string {
  if (!record.captionAvailable) return "UNAVAILABLE";
  // Third-party YouTube captions need the owner's authorisation to download (README).
  if (record.sourceSystemId === "youtube") return "NOT_AUTHORIZED";
  return record.rights.allowsTranscriptStorage ? "NOT_REQUESTED" : "STORAGE_NOT_PERMITTED";
}

async function insertRights(client: PoolClient, sourceRecordId: string, rights: RightsEvidence) {
  await client.query(
    `INSERT INTO rights_assertions (source_record_id, license_name, license_url, attribution_text, allows_embedding,
       allows_metadata_storage, allows_thumbnail_storage, allows_transcript_storage, allows_media_storage,
       allows_adaptation, allows_commercial_use, attribution_required, evidence_url, evidence_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      sourceRecordId,
      rights.licenseName,
      rights.licenseUrl,
      rights.attributionText,
      rights.allowsEmbedding,
      rights.allowsMetadataStorage,
      rights.allowsThumbnailStorage,
      rights.allowsTranscriptStorage,
      rights.allowsMediaStorage,
      rights.allowsAdaptation,
      rights.allowsCommercialUse,
      rights.attributionRequired,
      rights.evidenceUrl,
      rights.evidenceText,
    ],
  );
}

async function upsertInTransaction(client: PoolClient, record: NormalizedRecord, runId: string | null, hash: string, priority: number) {
  // 1. Lock the unique source record (source_system_id, external_id).
  const existing = (
    await client.query(
      "SELECT id, content_item_id, metadata_hash FROM source_records WHERE source_system_id = $1 AND external_id = $2 FOR UPDATE",
      [record.sourceSystemId, record.externalId],
    )
  ).rows[0];

  if (existing && existing.metadata_hash === hash) {
    await client.query("UPDATE source_records SET last_verified_at = now(), available = true WHERE id = $1", [existing.id]);
    return { result: "unchanged" as const, contentItemId: existing.content_item_id as string };
  }

  const sourceValues = [
    runId,
    record.sourceUrl,
    record.embedUrl,
    record.mediaUrl,
    record.mediaMimeType,
    JSON.stringify(record.thumbnails),
    record.creator,
    record.captionAvailable,
    record.madeForKids,
    record.embeddable,
    JSON.stringify(record.rawMetadata),
    hash,
    record.story ? JSON.stringify(record.story) : null,
  ];
  let contentItemId: string;
  let sourceRecordId: string;

  if (!existing) {
    // 2. Create the canonical content item and 3. its source record with raw metadata.
    contentItemId = (
      await client.query(
        `INSERT INTO content_items (content_type, title, description, language, duration_seconds, thumbnail_url, keywords)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [record.contentType, record.title, record.description, record.language, record.durationSeconds, record.thumbnailUrl, record.tags.slice(0, 30)],
      )
    ).rows[0].id;
    sourceRecordId = (
      await client.query(
        `INSERT INTO source_records (content_item_id, source_system_id, external_id, ingestion_run_id, source_url, embed_url,
           media_url, media_mime_type, thumbnails, creator, caption_available, made_for_kids, embeddable, raw_metadata,
           metadata_hash, story, fetched_at, last_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now()) RETURNING id`,
        [contentItemId, record.sourceSystemId, record.externalId, ...sourceValues],
      )
    ).rows[0].id;
    await client.query(
      `INSERT INTO transcripts (source_record_id, language, origin, retrieval_status, storage_permitted, source_url)
       VALUES ($1, $2, 'SOURCE_CAPTION', $3, $4, $5)`,
      [sourceRecordId, record.language, transcriptStatus(record), record.rights.allowsTranscriptStorage === true, record.sourceUrl],
    );
  } else {
    contentItemId = existing.content_item_id;
    sourceRecordId = existing.id;
    await client.query(
      `UPDATE source_records SET ingestion_run_id = $2, source_url = $3, embed_url = $4, media_url = $5, media_mime_type = $6,
         thumbnails = $7, creator = $8, caption_available = $9, made_for_kids = $10, embeddable = $11, raw_metadata = $12,
         metadata_hash = $13, story = $14, fetched_at = now(), last_verified_at = now(), available = true
       WHERE id = $1`,
      [sourceRecordId, ...sourceValues],
    );
    // Source-owned fields refresh; an admin's edited title/description wins (README field ownership).
    await client.query(
      `UPDATE content_items SET
         title = CASE WHEN EXISTS (SELECT 1 FROM editorial_revisions e WHERE e.content_item_id = $1 AND e.changes ? 'title') THEN title ELSE $2 END,
         description = CASE WHEN EXISTS (SELECT 1 FROM editorial_revisions e WHERE e.content_item_id = $1 AND e.changes ? 'description') THEN description ELSE $3 END,
         duration_seconds = $4, thumbnail_url = $5, language = COALESCE(language, $6), keywords = $7,
         analysis_status = 'QUEUED', updated_at = now()
       WHERE id = $1`,
      [contentItemId, record.title, record.description, record.durationSeconds, record.thumbnailUrl, record.language, record.tags.slice(0, 30)],
    );
  }

  await client.query(
    `INSERT INTO source_record_snapshots (source_record_id, ingestion_run_id, raw_metadata, metadata_hash, fetched_at)
     VALUES ($1, $2, $3, $4, now()) ON CONFLICT (source_record_id, metadata_hash) DO NOTHING`,
    [sourceRecordId, runId, JSON.stringify(record.rawMetadata), hash],
  );
  // 4. Current rights assertion (a new one supersedes earlier evidence; history is kept).
  await insertRights(client, sourceRecordId, record.rights);
  // 5. Queue analysis through the durable outbox, inside the same transaction.
  await enqueueJob(client, {
    type: "ANALYZE",
    aggregateType: "content_item",
    aggregateId: contentItemId,
    payload: { hints: record.hints },
    priority,
    dedupeKey: `analyze:${contentItemId}`,
  });
  return { result: existing ? ("updated" as const) : ("created" as const), contentItemId };
}

export async function upsertRecord(record: NormalizedRecord, runId: string | null, priority = 0): Promise<{ result: UpsertResult; contentItemId: string }> {
  const hash = metadataHash(record);
  try {
    return await withTransaction((client) => upsertInTransaction(client, record, runId, hash, priority));
  } catch (error) {
    // Two runs inserted the same new item at once: the loser retries as an update.
    if ((error as { code?: string }).code === "23505") {
      return withTransaction((client) => upsertInTransaction(client, record, runId, hash, priority));
    }
    throw error;
  }
}

export async function getIngestionRun(db: Db, runId: string) {
  const run = (await db.query("SELECT * FROM ingestion_runs WHERE id = $1", [runId])).rows[0];
  if (!run) return null;
  const errors = (
    await db.query(
      `SELECT external_id, error_code AS code, redacted_message AS message, retryable, occurred_at
       FROM ingestion_errors WHERE ingestion_run_id = $1 ORDER BY occurred_at LIMIT 500`,
      [runId],
    )
  ).rows;
  // README "Connector result contract".
  return {
    ingestion_run_id: run.id,
    source_system_id: run.source_system_id,
    connector_version: run.connector_version,
    query: run.query,
    started_at: run.started_at,
    finished_at: run.finished_at,
    status: run.status,
    records_seen: run.records_seen,
    records_created: run.records_created,
    records_updated: run.records_updated,
    records_unchanged: run.records_unchanged,
    records_rejected_before_ai: run.records_rejected_before_ai,
    errors,
  };
}
