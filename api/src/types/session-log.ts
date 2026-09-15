export type SessionOutcome = "completed" | "skipped" | "exited";

export interface WatchedVideoEntry {
  contentId: string;
  title: string;
  durationSeconds: number;
}

export interface SessionLogRecord {
  id: string;
  uid: string;
  childId: string;
  durationMinutes: number;
  watched: WatchedVideoEntry[];
  outcome: SessionOutcome;
  usedFallback: boolean;
  fallbackCategory: string | null;
  loggedAt: string;
}

export interface CreateSessionLogInput {
  durationMinutes: number;
  watched: WatchedVideoEntry[];
  outcome: SessionOutcome;
  usedFallback: boolean;
  fallbackCategory: string | null;
}
