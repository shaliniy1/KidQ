/**
 * A family's shared video library (spec Section 7 "Library tagging" —
 * per-family, not per-child; the per-child concept is the separate
 * exclude list in Section 7's "Removing a KidQ-recommended video", built
 * in ticket 10). P5's "Add to Library" and P9 My Videos (ticket 11) both
 * read/write this same store.
 */
export type LibraryTag = "kidq_recommended" | "picked_by_parent" | "admin_approved_from_submission";
export type LibraryVisibility = "private" | "public";
export type SubmissionStatus = "none" | "pending" | "approved" | "rejected";

export interface LibraryEntry {
  id: string;
  /** Owning account's Firebase UID (family-level, not per-child). */
  uid: string;
  contentId: string;
  title: string;
  category: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  tag: LibraryTag;
  /**
   * Default Private — usable by this family instantly, no admin approval
   * needed (spec Section 7). Public means the parent asked to also suggest
   * it to other families; never changes this family's own instant access.
   */
  visibility: LibraryVisibility;
  /** "none" for anything never submitted publicly; "pending" until the Admin queue decides. */
  submissionStatus: SubmissionStatus;
  addedAt: string;
}
