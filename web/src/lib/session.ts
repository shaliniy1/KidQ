"use client";

// Parent sign-in. QA/prod: Supabase Auth (Google OAuth); the API checks
// app_metadata.role = "parent" (the default for any non-admin account).
// Local development without Supabase: an API dev token (the API must run
// with AUTH_MODE=dev).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
export const usingDevLogin = !supabase;

const DEV_TOKEN_KEY = "kidq-web-dev-token";

function readDevToken(): string | null {
  try {
    return window.localStorage.getItem(DEV_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (supabase) return (await supabase.auth.getSession()).data.session?.access_token ?? null;
  return readDevToken();
}

/** Starts the Google OAuth redirect flow. No-op in dev-token mode — call devSignIn instead. */
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  if (error) throw new Error(error.message);
}

/** Local dev only (no Supabase project configured): stores a dev bearer token. */
export function devSignIn(): void {
  const fixed = process.env.NEXT_PUBLIC_DEV_PARENT_TOKEN;
  window.localStorage.setItem(DEV_TOKEN_KEY, fixed ?? `dev:parent:${crypto.randomUUID()}`);
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
  try {
    window.localStorage.removeItem(DEV_TOKEN_KEY);
  } catch {
    // Storage may be blocked; nothing to clear.
  }
}

/** True once we know whether a session exists (Supabase) or a dev token is set. */
export async function hasSession(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}

/** Fires cb once immediately and again on every sign-in/sign-out. Dev-token mode fires once, immediately. */
export function onSessionChange(cb: () => void): () => void {
  if (!supabase) {
    cb();
    return () => {};
  }
  cb();
  const { data } = supabase.auth.onAuthStateChange(() => cb());
  return () => data.subscription.unsubscribe();
}
