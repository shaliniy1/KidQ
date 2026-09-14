import type { User } from "firebase/auth";
import { apiFetch } from "./api";
import type { AssembledSession, TimeBandMode } from "@/types/session";

export async function startSession(
  user: User,
  childId: string,
  durationMinutes: number,
  timeBandMode: TimeBandMode
): Promise<AssembledSession> {
  const idToken = await user.getIdToken();
  const { session } = await apiFetch<{ session: AssembledSession }>(`/children/${childId}/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ durationMinutes, timeBandMode }),
  });
  return session;
}
