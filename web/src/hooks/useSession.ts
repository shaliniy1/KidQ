"use client";

import { useEffect, useState } from "react";
import { hasSession, onSessionChange } from "@/lib/session";

export type SessionStatus = "loading" | "authed" | "anon";

/** Tracks whether a Supabase session (or, in dev mode, a dev token) exists. */
export function useSession(): SessionStatus {
  const [status, setStatus] = useState<SessionStatus>("loading");

  useEffect(() => {
    return onSessionChange(() => {
      hasSession().then((authed) => setStatus(authed ? "authed" : "anon"));
    });
  }, []);

  return status;
}
