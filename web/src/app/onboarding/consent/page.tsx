"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getConsentStatus, recordConsent } from "@/services/consent";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

/**
 * P1 DPDP Consent Gate. One-time, before any child profile (spec Section 0).
 * Tap-only — no voice input here (Section 8: mandatory/compliance-critical
 * fields stay tap-only, misrecognition risk is unacceptable).
 *
 * NOTE: consent is recorded locally only (no real API endpoint yet for it —
 * see web/src/services/consent.ts).
 */
export default function ConsentGatePage() {
  const router = useRouter();
  const status = useSession();
  const [phase, setPhase] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [checked, setChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    getConsentStatus().then((consentStatus) => {
      if (consentStatus.hasConsented) {
        router.replace("/onboarding/profile");
        return;
      }
      setPhase("ready");
    });
  }, [status, router]);

  async function handleContinue() {
    if (!checked) return;
    setPhase("submitting");
    setErrorMessage(null);
    try {
      await recordConsent();
      router.replace("/onboarding/profile");
    } catch (error) {
      setPhase("ready");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't record consent");
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
      <Card style={{ maxWidth: 420, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
        <button
          onClick={() => router.push("/login")}
          aria-label="Back"
          style={{
            alignSelf: "flex-start",
            background: "none",
            border: "none",
            color: "var(--kq-text-secondary)",
            fontSize: "var(--kq-text-body)",
            cursor: "pointer",
            padding: 4,
          }}
        >
          ← Back
        </button>

        <div>
          <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
            Before we set up your child&apos;s KidQ
          </h1>
          <p style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-body)", marginTop: 8 }}>
            We collect only what&apos;s needed to run KidQ safely for your family — never a
            child&apos;s legal name, and nothing shared beyond what this app needs, in line with
            India&apos;s Digital Personal Data Protection Act.
          </p>
        </div>

        {phase === "loading" && <p style={{ color: "var(--kq-text-secondary)" }}>Loading…</p>}

        {phase !== "loading" && (
          <>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
                minHeight: "var(--kq-tap-min)",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
                style={{ width: 22, height: 22, marginTop: 2, accentColor: "var(--kq-teal)" }}
              />
              <span style={{ fontSize: "var(--kq-text-body)", color: "var(--kq-charcoal)" }}>
                I understand and consent to KidQ collecting my child&apos;s nickname and age
                band to personalize their experience.
              </span>
            </label>

            {errorMessage && (
              <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>
            )}

            <Button variant="primary" disabled={!checked || phase === "submitting"} onClick={handleContinue}>
              {phase === "submitting" ? "Continuing…" : "Continue"}
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
