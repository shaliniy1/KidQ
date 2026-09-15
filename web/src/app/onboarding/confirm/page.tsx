"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getChildren, type ChildProfile } from "@/services/child-profile";
import { mascotColorForIndex } from "@/lib/mascot-colors";
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
  const status = useSession();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    getChildren()
      .then((fetched) => {
        setChildren(fetched);
        setPhase("ready");
      })
      .catch((error) => {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load your children's profiles");
      });
  }, [status]);

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

        {children.map((child, index) => (
          <Card key={child.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar color={mascotColorForIndex(index)} label={child.nickname[0]?.toUpperCase() ?? "?"} size={48} />
              <div>
                <h2 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
                  {child.nickname}
                </h2>
                <p style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-caption)" }}>Age {child.age_band}</p>
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
