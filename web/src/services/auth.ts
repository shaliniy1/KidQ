import { signInWithGoogle as startGoogleSignIn, devSignIn, signOut as endSession, usingDevLogin } from "@/lib/session";
import { ApiFailure } from "@/lib/api";
import { getMe } from "./child-profile";

export { usingDevLogin };

/** One shared Google account per family — no per-caregiver identity is created here. */
export async function signInWithGoogle(): Promise<void> {
  await startGoogleSignIn();
}

/** Local dev only (no Supabase project configured for this environment). */
export function signInForDev(): void {
  devSignIn();
}

export async function signOutOfKidQ(): Promise<void> {
  await endSession();
}

export interface SessionRouting {
  onboardingComplete: boolean;
}

/** Asks the real API whether this account has finished onboarding yet. */
export async function fetchSessionRouting(): Promise<SessionRouting> {
  try {
    await getMe();
    return { onboardingComplete: true };
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 404) {
      return { onboardingComplete: false };
    }
    throw error;
  }
}
