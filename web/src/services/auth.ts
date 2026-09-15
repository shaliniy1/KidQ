import { supabase } from "@/lib/supabase";

export class AuthNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured — see web/.env.example.");
    this.name = "AuthNotConfiguredError";
  }
}

/** True once real Supabase client config has been filled in (see web/.env.example). */
export const isAuthConfigured = Boolean(supabase);

/**
 * Minimal user shape the rest of web/ depends on — deliberately shaped like Firebase's old
 * `User` (uid, email, getIdToken()) so every screen that was wired to the placeholder Firebase
 * auth keeps working unchanged now that it's backed by the real Supabase session instead.
 */
export interface KidQUser {
  uid: string;
  email: string | null;
  getIdToken: () => Promise<string>;
}

function toKidQUser(userId: string, email: string | null): KidQUser {
  return {
    uid: userId,
    email,
    getIdToken: async () => {
      if (!supabase) return "";
      // supabase-js auto-refreshes the session in the background, so re-reading it here
      // (rather than caching the token) mirrors Firebase's getIdToken() always-fresh behavior.
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? "";
    },
  };
}

/** One shared Google account per family (spec Section 0) — no per-caregiver identity is created here. */
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new AuthNotConfiguredError();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  if (error) throw new Error(error.message);
  // Supabase redirects the whole page to Google and back; there's nothing further to return —
  // the root page (app/page.tsx) picks up the new session via onAuthChange once we're back.
}

export async function signOutOfKidQ(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Subscribes to auth state; returns the unsubscribe function. */
export function onAuthChange(callback: (user: KidQUser | null) => void): () => void {
  if (!supabase) {
    callback(null);
    return () => {};
  }
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ? toKidQUser(session.user.id, session.user.email ?? null) : null);
  });
  return () => subscription.unsubscribe();
}

export interface SessionRouting {
  onboardingComplete: boolean;
  /** The parent's real display name from GET /me — null for a new parent (nothing saved yet). */
  parentName: string | null;
}

/**
 * Asks the real backend whether this parent has finished onboarding, via GET /me.
 * A 404 NOT_ONBOARDED response means "new parent, show onboarding"; anything else that
 * succeeds means "returning parent, go straight to session," and also returns their real
 * saved name. Replaces the old Firebase-only POST /auth/session exchange — main's real /me
 * already answers both questions directly.
 */
export async function fetchSessionRouting(user: KidQUser): Promise<SessionRouting> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not set");
  const idToken = await user.getIdToken();
  const res = await fetch(`${apiUrl}/me`, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 404) return { onboardingComplete: false, parentName: null };
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `GET /me failed with status ${res.status}`);
  }
  const me: { parent: { name: string } } = await res.json();
  return { onboardingComplete: true, parentName: me.parent.name };
}
