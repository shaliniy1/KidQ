export interface SessionCompletePayload {
  childId: string;
  durationMinutes: number;
  watched: { title: string; durationSeconds: number }[];
  outcome: "completed" | "skipped" | "exited";
  /** Factual, neutral disclosure line — spec Section 2 Rule 6 / ticket 09. */
  thinPoolDisclosure: string | null;
}

export interface SubmissionDecisionPayload {
  title: string;
}

export type InboxNotification =
  | { id: string; uid: string; type: "session_complete"; payload: SessionCompletePayload; read: boolean; createdAt: string }
  | { id: string; uid: string; type: "submission_approved" | "submission_rejected"; payload: SubmissionDecisionPayload; read: boolean; createdAt: string };

export type NotificationType = InboxNotification["type"];
