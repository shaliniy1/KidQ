/**
 * A family's shared video library (spec Section 7 "Library tagging" —
 * per-family, not per-child; the per-child concept is the separate
 * exclude list in Section 7's "Removing a KidQ-recommended video", built
 * in ticket 10). P5's "Add to Library" and P9 My Videos (ticket 11) both
 * read/write this same store.
 */
export type LibraryTag = "kidq_recommended" | "picked_by_parent" | "admin_approved_from_submission";

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
  addedAt: string;
}
