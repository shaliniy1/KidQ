import type { Request, Response } from "express";
import { listFeedback, setFeedback } from "../services/feedback-store";
import type { Sentiment } from "../types/feedback";

const VALID_SENTIMENTS: Sentiment[] = ["up", "down"];

export async function postFeedback(req: Request, res: Response) {
  const contentId = typeof req.body?.contentId === "string" ? req.body.contentId : "";
  const sentiment = req.body?.sentiment;
  if (!contentId) return res.status(400).json({ error: "contentId is required" });
  if (!VALID_SENTIMENTS.includes(sentiment)) {
    return res.status(400).json({ error: `sentiment must be one of ${VALID_SENTIMENTS.join(", ")}` });
  }

  const entry = await setFeedback(req.user!.id, contentId, sentiment);
  return res.json({ feedback: entry });
}

export async function getFeedback(req: Request, res: Response) {
  const entries = await listFeedback(req.user!.id);
  return res.json({ feedback: entries });
}
