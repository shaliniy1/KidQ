import { randomUUID } from "node:crypto";
import { createJsonFileStore } from "../lib/json-file-store";
import type { InboxNotification, NotificationType, SessionCompletePayload } from "../types/inbox";

const inbox = createJsonFileStore<InboxNotification>("inbox.json");

export async function addNotification(
  uid: string,
  type: NotificationType,
  payload: SessionCompletePayload
): Promise<InboxNotification> {
  const notification: InboxNotification = {
    id: randomUUID(),
    uid,
    type,
    payload,
    read: false,
    createdAt: new Date().toISOString(),
  };
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
    result = { ...existing, read: true };
    all[notificationId] = result;
  });
  return result;
}
