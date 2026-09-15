import type { User } from "firebase/auth";
import { apiFetch } from "./api";
import type { DetectedVideo, LibraryEntry, LibraryVisibility } from "@/types/library";

async function authHeaders(user: User): Promise<HeadersInit> {
  return { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" };
}

export async function detectVideo(user: User, url: string): Promise<DetectedVideo> {
  return apiFetch<DetectedVideo>("/videos/detect", {
    method: "POST",
    headers: await authHeaders(user),
    body: JSON.stringify({ url }),
  });
}

export async function getMyVideos(user: User): Promise<LibraryEntry[]> {
  const { entries } = await apiFetch<{ entries: LibraryEntry[] }>("/library", { headers: await authHeaders(user) });
  return entries;
}

export async function addVideo(
  user: User,
  video: DetectedVideo,
  category: string,
  visibility: LibraryVisibility
): Promise<LibraryEntry> {
  const { entry } = await apiFetch<{ entry: LibraryEntry }>("/library", {
    method: "POST",
    headers: await authHeaders(user),
    body: JSON.stringify({
      contentId: video.contentId,
      title: video.title,
      category,
      durationSeconds: video.durationSeconds,
      thumbnailUrl: video.thumbnailUrl,
      embedUrl: video.embedUrl,
      visibility,
    }),
  });
  return entry;
}

export async function removeVideo(user: User, entryId: string): Promise<void> {
  await apiFetch(`/library/${entryId}`, { method: "DELETE", headers: await authHeaders(user) });
}

/** Dev/QA-only — see INTEGRATION_NOTES.md #6. Simulates the Admin review queue's decision. */
export async function simulateAdminDecision(user: User, entryId: string, decision: "approved" | "rejected"): Promise<void> {
  await apiFetch(`/library/${entryId}/simulate-admin-decision`, {
    method: "POST",
    headers: await authHeaders(user),
    body: JSON.stringify({ decision }),
  });
}
