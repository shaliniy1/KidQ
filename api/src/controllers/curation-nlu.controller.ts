import type { Request, Response } from "express";
import { extractCurationTags } from "../services/curation-nlu";

export async function postCurationNlu(req: Request, res: Response) {
  const transcript = typeof req.body?.transcript === "string" ? req.body.transcript.trim() : "";
  if (!transcript) {
    return res.status(400).json({ error: "transcript is required" });
  }
  const result = await extractCurationTags(transcript);
  return res.json(result);
}
