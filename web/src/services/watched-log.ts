import { api, unwrap } from "@/lib/api";
import type { AssembledSession } from "./session";

/** The handoff log: recent sessions, what was watched and how each ended. */
export async function getWatchedLog(childId: string): Promise<AssembledSession[]> {
  return unwrap(await api.GET("/children/{id}/sessions", { params: { path: { id: childId } } })).items;
}

export class NotYetAvailableError extends Error {
  constructor(feature: string) {
    super(`${feature} isn't available yet — there's no real API for it (see INTEGRATION_NOTES.md).`);
    this.name = "NotYetAvailableError";
  }
}

/**
 * Per-video thumbs up/down has no real endpoint yet — the API records an
 * item's watch OUTCOME (COMPLETED/SKIPPED/EXITED), not a parent sentiment.
 * Left as an explicit gap rather than a fabricated success.
 */
export async function setFeedback(): Promise<never> {
  throw new NotYetAvailableError("Per-video feedback");
}

/**
 * "Exclude from this child while keeping it in the family library" has no
 * real endpoint — the library is already per-child on the real API.
 */
export async function excludeFromChild(): Promise<never> {
  throw new NotYetAvailableError("Per-child exclude");
}
