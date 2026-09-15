import { getWatchedLog } from "./watched-log";
import type { AssembledSession } from "./session";

export interface InboxNotification {
  id: string;
  kind: "session-complete";
  session: AssembledSession;
}

/**
 * There is no real /inbox endpoint yet. As an honest stand-in, this derives
 * "session complete" notifications from the real session log rather than
 * inventing a notification store — submission approved/rejected
 * notifications are a genuine gap (there's no parent-facing push for those
 * yet; poll GET /children/:id/submissions instead).
 */
export async function getInbox(childId: string): Promise<InboxNotification[]> {
  const sessions = await getWatchedLog(childId);
  return sessions
    .filter((session) => session.ended_at)
    .map((session) => ({ id: session.id, kind: "session-complete" as const, session }));
}

export async function markNotificationRead(): Promise<void> {
  // No server-side read state exists yet for the derived notifications above.
}
