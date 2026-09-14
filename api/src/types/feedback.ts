export type Sentiment = "up" | "down";

export interface FeedbackEntry {
  /** Keyed by `${uid}:${contentId}` — one sentiment per account per video. */
  key: string;
  uid: string;
  contentId: string;
  sentiment: Sentiment;
  updatedAt: string;
}
