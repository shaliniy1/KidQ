// Re-check a video at its source (README "Upsert and refresh": unpublish approved items that
// become unavailable). Triggered by player error reports and periodic checks; a report alone
// never hides content — only a confirmed check does.
import { fetchYouTubeVideos } from "../connectors/youtube";
import { getPool, withTransaction } from "../db/pool";
import { recordDecision } from "../repositories/decisions";
import { upsertRecord } from "./ingestion";
import { rescoreItem } from "./scoring";

export async function verifyAvailability(contentItemId: string): Promise<"AVAILABLE" | "UNAVAILABLE" | "SKIPPED"> {
  const source = (
    await getPool().query(
      "SELECT id, source_system_id, external_id FROM source_records WHERE content_item_id = $1 ORDER BY fetched_at DESC LIMIT 1",
      [contentItemId],
    )
  ).rows[0];
  // NASA and Wikimedia files are checked when their next discovery run refreshes them.
  if (!source || source.source_system_id !== "youtube") return "SKIPPED";

  const batch = await fetchYouTubeVideos([source.external_id]);
  if (batch.records.length === 1) {
    await upsertRecord(batch.records[0], null);
    return "AVAILABLE";
  }

  const code = batch.errors[0]?.code ?? "REJECTED_UNAVAILABLE";
  await withTransaction(async (client) => {
    await client.query("UPDATE source_records SET available = false, last_verified_at = now() WHERE id = $1", [source.id]);
    const item = (await client.query("SELECT current_status FROM content_items WHERE id = $1 FOR UPDATE", [contentItemId])).rows[0];
    if (item?.current_status === "APPROVED") {
      await recordDecision(client, contentItemId, {
        decision: "MANUAL_REVIEW_REQUIRED",
        reason: `Hidden automatically: YouTube check returned ${code}.`,
        decidedBy: "system:availability-check",
        source: "SYSTEM",
      });
    }
    await rescoreItem(client, contentItemId);
  });
  return "UNAVAILABLE";
}
