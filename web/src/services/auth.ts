import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { firebaseAuth, googleAuthProvider, isFirebaseConfigured } from "@/lib/firebase";
import { apiFetch } from "./api";

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super("Firebase is not configured — see web/.env.example.");
    this.name = "FirebaseNotConfiguredError";
  }
}

/** One shared Google account per family (spec Section 0) — no per-caregiver identity is created here. */
export async function signInWithGoogle(): Promise<User> {
  if (!firebaseAuth || !isFirebaseConfigured) throw new FirebaseNotConfiguredError();
  const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
  return result.user;
}

export async function signOutOfKidQ(): Promise<void> {
  if (!firebaseAuth) return;
  await signOut(firebaseAuth);
}

/** Subscribes to auth state; returns the unsubscribe function. */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  if (!firebaseAuth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, callback);
}

export interface SessionRouting {
  onboardingComplete: boolean;
  email: string | null;
}

/**
 * Exchanges the signed-in user's ID token for the onboarding-routing flag.
 * Sends only the token — the backend derives uid/email itself by verifying
 * it, never from anything the client asserts.
 */
export async function fetchSessionRouting(user: User): Promise<SessionRouting> {
  const idToken = await user.getIdToken();
  return apiFetch<SessionRouting>("/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
}
