import type { Request, Response } from "express";
import { getOrCreateAccount } from "../services/account-store";

/**
 * Exchanges a Firebase ID token (obtained client-side from Google Sign-In,
 * verified by the requireAuth middleware) for this account's
 * onboarding-routing flag.
 */
export async function createSession(req: Request, res: Response) {
  const account = await getOrCreateAccount(req.identity!.uid, req.identity!.email);
  return res.json({
    onboardingComplete: account.onboardingComplete,
    email: account.email,
    // Used for My Videos' "Picked by [Parent name]" tag (spec Section 7) —
    // added here rather than a new endpoint since /auth/session already
    // runs on every app load.
    parentName: account.parentName,
  });
}
