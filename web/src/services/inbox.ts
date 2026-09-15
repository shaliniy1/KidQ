import type { User } from "firebase/auth";
import { apiFetch } from "./api";
import type { InboxNotification, SessionOutcome } from "@/types/inbox";
import type { AssembledSession } from "@/types/session";

async function authHeaders(user: User): Promise<HeadersInit> {
  return { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" };
}

export async function getInbox(user: User): Promise<InboxNotification[]> {
  const { notifications } = await apiFetch<{ notifications: InboxNotification[] }>("/inbox", {
    headers: await authHeaders(user),
  });
  return notifications;
}

export async function markNotificationRead(user: User, notificationId: string): Promise<void> {
  await apiFetch(`/inbox/${notificationId}/read`, { method: "POST", headers: await authHeaders(user) });
}

/**
 * Logs a session's outcome from the child device (spec Section 5). Called
 * by the /play/[childId] stub (ticket 07's Child Player stand-in) since
 * the real Child Player is out of scope here.
 */
export async function logSessionOutcome(
  user: User,
  childId: string,
  session: AssembledSession,
  outcome: SessionOutcome
): Promise<void> {
  const allVideos = session.slots.flatMap((slot) => slot.videos);
  // A real early exit would only have watched part of the queue — this
  // stand-in approximates that as "everything up to the first slot" for
  // skipped/exited, and the full queue for completed.
  const watched =
    outcome === "completed" ? allVideos : session.slots[0]?.videos ?? [];

  await apiFetch(`/children/${childId}/session-log`, {
    method: "POST",
    headers: await authHeaders(user),
    body: JSON.stringify({
      durationMinutes: session.durationMinutes,
      watched: watched.map((v) => ({ contentId: v.contentId, title: v.title, durationSeconds: v.durationSeconds })),
      outcome,
      usedFallback: session.usedFallback,
      fallbackCategory: session.fallbackCategory,
    }),
  });
}
