export type SessionOutcome = "completed" | "skipped" | "exited";

export interface SessionCompletePayload {
  childId: string;
  durationMinutes: number;
  watched: { title: string; durationSeconds: number }[];
  outcome: SessionOutcome;
  thinPoolDisclosure: string | null;
}

export interface SubmissionDecisionPayload {
  title: string;
}

export type InboxNotification =
  | { id: string; uid: string; type: "session_complete"; payload: SessionCompletePayload; read: boolean; createdAt: string }
  | {
      id: string;
      uid: string;
      type: "submission_approved" | "submission_rejected";
      payload: SubmissionDecisionPayload;
      read: boolean;
      createdAt: string;
    };
