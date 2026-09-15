/**
 * One record per family Google account (Firebase UID). Per spec Section 0,
 * a family shares a single Google account across every caregiver — there is
 * no separate per-caregiver identity, so this store is keyed by Firebase
 * UID alone, not by (uid, caregiver).
 */
export interface AccountRecord {
  uid: string;
  email: string | null;
  createdAt: string;
  /** Set during P2 Screen 1 (ticket 04), alongside the first child profile. */
  parentName: string | null;
  /**
   * Flips to true once the account has completed onboarding for at least
   * one child (spec Section 0 routing rule). Set by the Child profile
   * store when the first child profile is saved (ticket 04) — this ticket
   * only reads and initializes it (false on first sign-in).
   */
  onboardingComplete: boolean;
}
