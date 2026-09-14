import type { User } from "firebase/auth";
import { apiFetch } from "./api";
import type { AssembledSession, TimeBandMode } from "@/types/session";

export interface StartSessionResult {
  session: AssembledSession;
  /** Reminder-only (spec Section 11 #27) — never blocks the session, just flags the soft note. */
  outsideScheduledWindow: boolean;
}

export async function startSession(
  user: User,
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
