import type { AgeBand } from "./parent-config";

export type MascotColorId = "teal" | "saffron" | "terracotta" | "mango" | "lavender";
export const MASCOT_COLOR_IDS: MascotColorId[] = ["teal", "saffron", "terracotta", "mango", "lavender"];

export interface ChildProfile {
  id: string;
  /** Owning account's Firebase UID. */
  uid: string;
  /** Free text — nickname only, never legal name (DPDP minimization, spec Section 1). */
  nickname: string;
  ageBand: AgeBand;
  mascotColor: MascotColorId;
  createdAt: string;
  /**
   * When this age band was set. NOTE (spec gap, flagged not silently
   * resolved): spec Section 11 #10 says age band should silently
   * re-derive when a child's actual age crosses a band boundary, but
   * Section 1 only ever captures a coarse band, never a birthdate — there
   * is no continuous signal to detect a crossing from. Recording
   * ageBandAssignedAt so a future birthdate-capture or estimation policy
   * has something to compute from; no automatic re-derivation is
   * implemented yet.
   */
  ageBandAssignedAt: string;
  /**
   * Remembered independently per child, never shared (spec Section 4 point
   * 0) — null until this child's first session is ever started.
   */
  lastUsedDurationMinutes: number | null;
  /**
   * Same tier as duration, not a curation-time setting (spec Section 9) —
   * remembered per child until the parent changes it, not per browser (a
   * browser-local preference would break for the second caregiver signing
   * into the same shared account on their own device, spec Section 0).
   */
  lastTimeBandMode: "auto" | "morning" | "daytime" | "bedtime";
}

export interface CreateChildInput {
  nickname: string;
  ageBand: AgeBand;
  mascotColor: MascotColorId;
}
