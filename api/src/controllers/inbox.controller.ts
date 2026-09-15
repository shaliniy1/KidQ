import type { Request, Response } from "express";
import { listNotifications, markNotificationRead } from "../services/inbox-store";

export async function getInbox(req: Request, res: Response) {
  const notifications = await listNotifications(req.user!.id);
  return res.json({ notifications });
}

export async function postMarkRead(req: Request, res: Response) {
  const notification = await markNotificationRead(req.user!.id, req.params.notificationId);
  if (!notification) return res.status(404).json({ error: "Notification not found" });
  return res.json({ notification });
}
