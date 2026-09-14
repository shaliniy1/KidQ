/**
 * Hands a curation-tag patch from a capture screen (voice or guided
 * questions) back to the Hub after navigating back to it. Session-only,
 * browser-local — nothing here ever touches the backend, preserving the
 * Hub's "nothing persists until Done/Save & back" contract (ticket 05).
 * Read once and cleared, so returning to the Hub later doesn't re-apply a
 * stale patch.
 */
export interface HubDraftPatch {
  interests: string[];
  contentMixMode: "surprise_us" | "choose_categories";
  contentMixCategories: string[];
  regulationGoals: string[];
}

function storageKey(childId: string): string {
  return `kidq:hub-draft-patch:${childId}`;
}

export function writeHubDraftPatch(childId: string, patch: HubDraftPatch): void {
  try {
    sessionStorage.setItem(storageKey(childId), JSON.stringify(patch));
  } catch {
    // sessionStorage can throw (private browsing, quota) — the parent just
    // reviews an unfilled Hub in that case, no crash.
  }
}

export function readAndClearHubDraftPatch(childId: string): HubDraftPatch | null {
  try {
    const raw = sessionStorage.getItem(storageKey(childId));
    if (!raw) return null;
    sessionStorage.removeItem(storageKey(childId));
    return JSON.parse(raw) as HubDraftPatch;
  } catch {
    return null;
  }
}
