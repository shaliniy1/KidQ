export type NotificationType = "session_complete" | "submission_approved" | "submission_rejected";

export interface SessionCompletePayload {
  childId: string;
  durationMinutes: number;
  watched: { title: string; durationSeconds: number }[];
  outcome: "completed" | "skipped" | "exited";
  /** Factual, neutral disclosure line — spec Section 2 Rule 6 / ticket 09. */
  thinPoolDisclosure: string | null;
}

export interface InboxNotification {
  id: string;
  uid: string;
  type: NotificationType;
  payload: SessionCompletePayload; // widen to a union if other notification types add their own payload shape (tickets 11)
  read: boolean;
  createdAt: string;
}
