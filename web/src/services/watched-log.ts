import type { KidQUser } from "./auth";
import { apiFetch } from "./api";
import type { FeedbackEntry, Sentiment, SessionLogRecord } from "@/types/watched-log";

async function authHeaders(user: KidQUser): Promise<HeadersInit> {
  return { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" };
}

export async function getWatchedLog(user: KidQUser, childId: string): Promise<SessionLogRecord[]> {
  const { logs } = await apiFetch<{ logs: SessionLogRecord[] }>(`/children/${childId}/watched-log`, {
    headers: await authHeaders(user),
  });
  return logs;
}

export async function getFeedback(user: KidQUser): Promise<FeedbackEntry[]> {
  const { feedback } = await apiFetch<{ feedback: FeedbackEntry[] }>("/feedback", { headers: await authHeaders(user) });
  return feedback;
}

export async function setFeedback(user: KidQUser, contentId: string, sentiment: Sentiment): Promise<void> {
  await apiFetch("/feedback", {
    method: "POST",
    headers: await authHeaders(user),
    body: JSON.stringify({ contentId, sentiment }),
  });
}

export async function excludeFromChild(user: KidQUser, childId: string, contentId: string): Promise<void> {
  await apiFetch(`/children/${childId}/exclude`, {
    method: "POST",
    headers: await authHeaders(user),
    body: JSON.stringify({ contentId }),
  });
}
