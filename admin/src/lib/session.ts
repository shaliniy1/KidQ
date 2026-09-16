"use client";

// Admin sign-in. QA/prod: Supabase Auth; the API checks app_metadata.role = "admin".
// Local development without Supabase: an API dev token (the API must run with AUTH_MODE=dev).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
export const usingDevLogin = !supabase;

const DEV_TOKEN_KEY = "kidq-admin-dev-token";

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

/** Supabase emails a reset link; dev login has no real password to reset. Never reveals whether the address has an account. */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error("Password reset isn't needed for local sign-in — enter any email to continue.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
  if (error) throw new Error(error.message);
}

export async function signIn(email: string, password: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return;
  }
  window.localStorage.setItem(DEV_TOKEN_KEY, `dev:admin:${crypto.randomUUID()}:${email}`);
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
  try {
    window.localStorage.removeItem(DEV_TOKEN_KEY);
  } catch {
    // Storage may be blocked; nothing to clear.
  }
}
