"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { KidQUser } from "@/services/auth";
import { onAuthChange } from "@/services/auth";
import { getChildren } from "@/services/child-profile";
import type { ChildProfile } from "@/types/child-profile";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

/**
 * P2-confirm — one card per child (a household may have several), each with
 * the three coequal choices from spec Section 11 #16: no mandatory detour
 * through a gatekeeping screen for any of them.
 */
export default function ConfirmPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userRef = useRef<KidQUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      userRef.current = user;
      try {
        const fetched = await getChildren(user);
        setChildren(fetched);
        setPhase("ready");
      } catch (error) {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load your children's profiles");
      }
    });
    return unsubscribe;
  }, [router]);

  if (phase === "loading") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--kq-text-secondary)" }}>Loading…</p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--kq-terracotta)" }}>{errorMessage}</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
        <button
          onClick={() => router.push("/onboarding/profile")}
          aria-label="Back"
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
        >
          ← Back
        </button>

        {children.map((child) => (
          <Card key={child.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar color={child.mascotColor} label={child.nickname[0]?.toUpperCase() ?? "?"} size={48} />
              <div>
                <h2 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
                  {child.nickname}
                </h2>
                <p style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-caption)" }}>Age {child.ageBand}</p>
              </div>
            </div>

            <p style={{ color: "var(--kq-charcoal)", fontSize: "var(--kq-text-body)" }}>
              We&apos;ve set up {child.nickname}&apos;s KidQ using just their age. Start right away, or
              fine-tune it below.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Button variant="primary" onClick={() => router.push("/session")}>
                Start using KidQ
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/hub/${child.id}?from=onboarding`)}>
                Customize for {child.nickname}
              </Button>
              <button
                onClick={() => router.push(`/recommendations/${child.id}`)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--kq-text-secondary)",
                  fontSize: "var(--kq-text-body)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 8,
                }}
              >
                Browse and pick myself
              </button>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
