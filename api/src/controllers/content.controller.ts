import type { Request, Response } from "express";
import { discoverContent } from "../services/content-discovery";
import { saveContent } from "../services/content-store";
import type { DiscoveryRequest } from "../types/content";

export async function discover(req: Request, res: Response) {
  try {
    const request = req.body as DiscoveryRequest;
    if (!request?.query && request.source === "youtube") return res.status(400).json({ error: "query is required for YouTube discovery" });
    if (request.source === "open_web" && (!request.open_urls || request.open_urls.length === 0)) return res.status(400).json({ error: "open_urls is required for open-web discovery" });
    const records = await discoverContent(request);
    await saveContent(records);
    return res.status(201).json({ count: records.length, records });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Content discovery failed" });
  }
}
