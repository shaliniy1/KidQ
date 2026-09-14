import { createJsonFileStore } from "../lib/json-file-store";
import type { DeviceSyncRecord } from "../types/device-sync";

const syncStore = createJsonFileStore<DeviceSyncRecord>("device-sync.json");

/** Called the moment a new session queue is assembled — starts life as "pending". */
export async function markQueued(childId: string, sessionId: string): Promise<DeviceSyncRecord> {
  const record: DeviceSyncRecord = {
    childId,
    sessionId,
    status: "pending",
    queuedAt: new Date().toISOString(),
    acknowledgedAt: null,
  };
  await syncStore.write((all) => {
    all[childId] = record; // one record per child — a new queue supersedes whatever was pending before
  });
  return record;
}

/** Called by the child device once it has actually received/loaded the queue. */
export async function acknowledge(childId: string, sessionId: string): Promise<DeviceSyncRecord | null> {
  let result: DeviceSyncRecord | null = null;
  await syncStore.write((all) => {
    const existing = all[childId];
    if (!existing || existing.sessionId !== sessionId) return; // stale ack for a superseded queue — ignore
    result = { ...existing, status: "acknowledged", acknowledgedAt: new Date().toISOString() };
    all[childId] = result;
  });
  return result;
}

export async function getSyncStatus(childId: string): Promise<DeviceSyncRecord | null> {
  const all = await syncStore.readAll();
  return all[childId] ?? null;
}
