import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Thrown when FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 * are unset or placeholder values — i.e. no real Firebase project has been
 * wired in yet. Callers should surface this as a clear 5xx "not configured"
 * response, never fall back to trusting an unverified client-supplied uid.
 */
export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Firebase Admin is not configured — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, " +
        "and FIREBASE_PRIVATE_KEY (see api/.env.example) to a real Firebase project's " +
        "service-account credentials."
    );
    this.name = "FirebaseNotConfiguredError";
  }
}

let app: App | null | undefined; // undefined = not yet attempted, null = attempted and unconfigured

function getFirebaseApp(): App {
  if (app) return app;
  if (app === null) throw new FirebaseNotConfiguredError();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // .env files can't hold real newlines in a value; the standard convention
  // (and what the Firebase console's downloaded key needs) is literal "\n".
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    app = null;
    throw new FirebaseNotConfiguredError();
  }

  app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export interface VerifiedIdentity {
  uid: string;
  email: string | null;
}

/** Verifies a Firebase ID token server-side. Never trust a client-passed uid instead of this. */
export async function verifyIdToken(idToken: string): Promise<VerifiedIdentity> {
  const auth = getAuth(getFirebaseApp());
  const decoded = await auth.verifyIdToken(idToken);
  return { uid: decoded.uid, email: decoded.email ?? null };
}
