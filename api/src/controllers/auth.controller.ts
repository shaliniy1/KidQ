import type { Request, Response } from "express";
import { FirebaseNotConfiguredError, verifyIdToken } from "../services/firebase-admin";
import { getOrCreateAccount } from "../services/account-store";

/**
 * Exchanges a Firebase ID token (obtained client-side from Google Sign-In)
 * for this account's onboarding-routing flag. The client sends only the
 * token — never a uid/email it claims itself — and every field used below
 * comes from the server-verified token, per the "never trust a
 * client-passed identity" rule.
 */
export async function createSession(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!idToken) {
    return res.status(401).json({ error: "Missing bearer ID token" });
  }

  try {
    const identity = await verifyIdToken(idToken);
    const account = await getOrCreateAccount(identity.uid, identity.email);
    return res.json({
      onboardingComplete: account.onboardingComplete,
      email: account.email,
    });
  } catch (error) {
    if (error instanceof FirebaseNotConfiguredError) {
      return res.status(501).json({ error: error.message });
    }
    return res.status(401).json({ error: "Invalid or expired ID token" });
  }
}
