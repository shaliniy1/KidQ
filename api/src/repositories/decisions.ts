// Publication decisions are the only way content_items.current_status changes (README
// "Field ownership"). The DB allows the system to take content down but never to approve.
import type { Db } from "../db/pool";

export type Decision = "APPROVED" | "REJECTED" | "MANUAL_REVIEW_REQUIRED";

export async function recordDecision(
  db: Db,
  contentItemId: string,
  input: {
    decision: Decision;
    reason: string;
    decidedBy: string;
    decidedByUserId?: string | null;
    source?: "ADMIN" | "SYSTEM";
    overrodeCriticalFlag?: boolean;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO publication_decisions (content_item_id, decision, reason, decided_by, decided_by_user_id, decision_source, overrode_critical_flag)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      contentItemId,
      input.decision,
      input.reason,
      input.decidedBy,
      input.decidedByUserId ?? null,
      input.source ?? "ADMIN",
      input.overrodeCriticalFlag ?? false,
    ],
  );
  // current_status is a projection of the latest decision, kept in the same transaction.
  await db.query(
    `UPDATE content_items SET current_status = $2,
       published_at = CASE WHEN $2 = 'APPROVED' THEN now() ELSE NULL END, updated_at = now()
     WHERE id = $1`,
    [contentItemId, input.decision],
  );
}
