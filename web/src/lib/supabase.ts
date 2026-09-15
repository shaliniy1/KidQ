"use client";

// Real Supabase Auth (Google sign-in), same pattern as admin/src/lib/session.ts.
// Leave both env vars empty locally to fall back to "not configured" (see @/services/auth).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
