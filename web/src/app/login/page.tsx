"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchSessionRouting, signInWithGoogle } from "@/services/auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import { GoogleIcon } from "@/components/GoogleIcon";
import { Card } from "@/components/Card";

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "signing-in" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn() {
    setStatus("signing-in");
    setErrorMessage(null);
    try {
      const user = await signInWithGoogle();
      const routing = await fetchSessionRouting(user);
      router.push(routing.onboardingComplete ? "/session" : "/onboarding/consent");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Sign-in failed");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <Card style={{ maxWidth: 360, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-hero)", color: "var(--kq-charcoal)" }}>
            KidQ
          </h1>
          <p style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-body)", marginTop: 4 }}>
            A calm, curated screen-time companion
          </p>
        </div>

        <button
          onClick={handleSignIn}
          disabled={status === "signing-in" || !isFirebaseConfigured}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            height: 54,
            borderRadius: "var(--kq-radius-control)",
            border: "2px solid var(--kq-border)",
            background: "var(--kq-white)",
            color: "var(--kq-charcoal)",
            fontFamily: "var(--kq-font-display)",
            fontWeight: 700,
            fontSize: 16,
            cursor: isFirebaseConfigured ? "pointer" : "not-allowed",
            opacity: status === "signing-in" ? 0.7 : 1,
          }}
        >
          <GoogleIcon />
          {status === "signing-in" ? "Signing in…" : "Continue with Google"}
        </button>

        {!isFirebaseConfigured && (
          <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>
            Google Sign-In isn&apos;t configured yet for this environment (see web/.env.example).
          </p>
        )}
        {status === "error" && errorMessage && (
          <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>
        )}

        <p style={{ color: "var(--kq-text-tertiary)", fontSize: "var(--kq-text-caption)" }}>
          One Google account per family — every caregiver signs in with the same account.
        </p>
      </Card>
    </main>
  );
}
