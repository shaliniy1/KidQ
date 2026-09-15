import type { KidQUser } from "./auth";
import { apiFetch } from "./api";
import type { AssembledSession, TimeBandMode } from "@/types/session";

export interface StartSessionResult {
  session: AssembledSession;
  /** Reminder-only (spec Section 11 #27) — never blocks the session, just flags the soft note. */
  outsideScheduledWindow: boolean;
}

export async function startSession(
  user: KidQUser,
  childId: string,
  durationMinutes: number,
  timeBandMode: TimeBandMode
): Promise<StartSessionResult> {
  const idToken = await user.getIdToken();
  return apiFetch<StartSessionResult>(`/children/${childId}/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ durationMinutes, timeBandMode }),
  });
}

/**
 * The real Child Player would call this the moment it actually receives/
 * loads a queue (ticket 15) — the /play stub calls it on mount, since
 * "the device has the queue" is implicitly true the moment that screen
 * successfully renders the session data.
 */
export async function acknowledgeSync(user: KidQUser, childId: string, sessionId: string): Promise<void> {
  const idToken = await user.getIdToken();
  await apiFetch(`/children/${childId}/sync-ack`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
}
