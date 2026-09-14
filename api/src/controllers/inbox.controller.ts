import type { Request, Response } from "express";
import { listNotifications, markNotificationRead } from "../services/inbox-store";

export async function getInbox(req: Request, res: Response) {
  const notifications = await listNotifications(req.identity!.uid);
  return res.json({ notifications });
}

export async function postMarkRead(req: Request, res: Response) {
  const notification = await markNotificationRead(req.identity!.uid, req.params.notificationId);
  if (!notification) return res.status(404).json({ error: "Notification not found" });
  return res.json({ notification });
}
