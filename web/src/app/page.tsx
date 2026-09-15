"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthChange, fetchSessionRouting } from "@/services/auth";

/**
 * App entry point — implements the spec Section 0 "Login & entry routing"
 * rule: not signed in -> /login; signed in -> ask the backend whether
 * onboarding is complete for this account and route to /onboarding/consent
 * (first-time) or /session (returning parent) accordingly.
 */
export default function RootRoutingPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasRouted = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (hasRouted.current) return;

      if (!user) {
        hasRouted.current = true;
        router.replace("/login");
        return;
      }

      try {
        const routing = await fetchSessionRouting(user);
        hasRouted.current = true;
        router.replace(routing.onboardingComplete ? "/session" : "/onboarding/consent");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Couldn't determine routing");
      }
    });

    return unsubscribe;
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "24px",
        textAlign: "center",
      }}
    >
      <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-hero)", color: "var(--kq-charcoal)" }}>
        KidQ
      </h1>
      {errorMessage ? (
        <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-body)" }}>{errorMessage}</p>
      ) : (
        <p style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-body)" }}>Loading…</p>
      )}
    </main>
  );
}
