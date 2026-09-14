export type SessionOutcome = "completed" | "skipped" | "exited";

export interface SessionCompletePayload {
  childId: string;
  durationMinutes: number;
  watched: { title: string; durationSeconds: number }[];
  outcome: SessionOutcome;
  thinPoolDisclosure: string | null;
}

export interface InboxNotification {
  id: string;
  uid: string;
  type: "session_complete" | "submission_approved" | "submission_rejected";
  payload: SessionCompletePayload;
  read: boolean;
  createdAt: string;
}
