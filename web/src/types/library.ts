export type LibraryTag = "kidq_recommended" | "picked_by_parent" | "admin_approved_from_submission";
export type LibraryVisibility = "private" | "public";
export type SubmissionStatus = "none" | "pending" | "approved" | "rejected";

export interface LibraryEntry {
  id: string;
  uid: string;
  contentId: string;
  title: string;
  category: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  tag: LibraryTag;
  visibility: LibraryVisibility;
  submissionStatus: SubmissionStatus;
  addedAt: string;
}

export interface DetectedVideo {
  contentId: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  embedUrl: string;
  trustBadge: string;
}
