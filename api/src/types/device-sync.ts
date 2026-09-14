export type SyncStatus = "pending" | "acknowledged";

/**
 * One record per child (spec speaks of "the child's device" singular —
 * no multi-device pairing/registration exists anywhere in this build, so
 * this isn't modeled per-device-id, just per-child) tracking whether the
 * most recently assembled session queue has reached the device yet.
 */
export interface DeviceSyncRecord {
  childId: string;
  sessionId: string;
  status: SyncStatus;
  queuedAt: string;
  acknowledgedAt: string | null;
}
