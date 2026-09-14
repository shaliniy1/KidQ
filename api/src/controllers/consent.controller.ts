import type { Request, Response } from "express";
import { getConsent, recordConsentOnce } from "../services/consent-store";

export async function getConsentStatus(req: Request, res: Response) {
  const consent = await getConsent(req.identity!.uid);
  res.json({ hasConsented: Boolean(consent), consent });
}

export async function createConsent(req: Request, res: Response) {
  const consent = await recordConsentOnce(req.identity!.uid);
  res.status(201).json({ consent });
}
