import { randomUUID } from "node:crypto";
import { createJsonFileStore } from "../lib/json-file-store";
import type { InboxNotification, SessionCompletePayload, SubmissionDecisionPayload } from "../types/inbox";

const inbox = createJsonFileStore<InboxNotification>("inbox.json");

export function addNotification(
  uid: string,
  type: "session_complete",
  payload: SessionCompletePayload
): Promise<InboxNotification>;
export function addNotification(
  uid: string,
  type: "submission_approved" | "submission_rejected",
  payload: SubmissionDecisionPayload
): Promise<InboxNotification>;
export async function addNotification(
  uid: string,
  type: InboxNotification["type"],
  payload: SessionCompletePayload | SubmissionDecisionPayload
): Promise<InboxNotification> {
  const notification = {
    id: randomUUID(),
    uid,
    type,
    payload,
    read: false,
    createdAt: new Date().toISOString(),
  } as InboxNotification;
  await inbox.write((all) => {
    all[notification.id] = notification;
  });
  return notification;
}

/** Newest first — surfaced on next app open, no push (spec Section 5 / Table B #12). */
export async function listNotifications(uid: string): Promise<InboxNotification[]> {
  const all = await inbox.readAll();
  return Object.values(all)
    .filter((n) => n.uid === uid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markNotificationRead(uid: string, notificationId: string): Promise<InboxNotification | null> {
  let result: InboxNotification | null = null;
  await inbox.write((all) => {
    const existing = all[notificationId];
    if (!existing || existing.uid !== uid) return;
    result = { ...existing, read: true } as InboxNotification;
    all[notificationId] = result;
  });
  return result;
}
