import { randomUUID } from "node:crypto";
import { createJsonFileStore } from "../lib/json-file-store";
import type { CreateSessionLogInput, SessionLogRecord } from "../types/session-log";

const logs = createJsonFileStore<SessionLogRecord>("session-logs.json");

export async function createSessionLog(
  uid: string,
  childId: string,
  input: CreateSessionLogInput
): Promise<SessionLogRecord> {
  const record: SessionLogRecord = {
    id: randomUUID(),
    uid,
    childId,
    loggedAt: new Date().toISOString(),
    ...input,
  };
  await logs.write((all) => {
    all[record.id] = record;
  });
  return record;
}

export async function listSessionLogs(uid: string, childId?: string): Promise<SessionLogRecord[]> {
  const all = await logs.readAll();
  return Object.values(all)
    .filter((log) => log.uid === uid && (!childId || log.childId === childId))
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}
