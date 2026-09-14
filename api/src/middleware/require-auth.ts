import type { NextFunction, Request, Response } from "express";
import { FirebaseNotConfiguredError, verifyIdToken, type VerifiedIdentity } from "../services/firebase-admin";

declare module "express-serve-static-core" {
  interface Request {
    /** Set by requireAuth once the bearer ID token has been server-verified. */
    identity?: VerifiedIdentity;
  }
}

/**
 * Verifies the request's `Authorization: Bearer <idToken>` header and
 * attaches the verified identity to `req.identity`. Every route that acts
 * on a specific account must use this — never trust a client-passed
 * uid/email instead.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!idToken) {
    return res.status(401).json({ error: "Missing bearer ID token" });
  }

  try {
    req.identity = await verifyIdToken(idToken);
    next();
  } catch (error) {
    if (error instanceof FirebaseNotConfiguredError) {
      return res.status(501).json({ error: error.message });
    }
    return res.status(401).json({ error: "Invalid or expired ID token" });
  }
}
