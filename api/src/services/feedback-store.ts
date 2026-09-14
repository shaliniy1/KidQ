import { createJsonFileStore } from "../lib/json-file-store";
import type { FeedbackEntry, Sentiment } from "../types/feedback";

const feedback = createJsonFileStore<FeedbackEntry>("feedback.json");

function keyFor(uid: string, contentId: string): string {
  return `${uid}:${contentId}`;
}

/** Feeds future ranking as a preference signal (spec Section 9) — consumed by the external scoring engine, not rebuilt here. */
export async function setFeedback(uid: string, contentId: string, sentiment: Sentiment): Promise<FeedbackEntry> {
  const key = keyFor(uid, contentId);
  const entry: FeedbackEntry = { key, uid, contentId, sentiment, updatedAt: new Date().toISOString() };
  await feedback.write((all) => {
    all[key] = entry;
  });
  return entry;
}

export async function listFeedback(uid: string): Promise<FeedbackEntry[]> {
  const all = await feedback.readAll();
  return Object.values(all).filter((entry) => entry.uid === uid);
}
