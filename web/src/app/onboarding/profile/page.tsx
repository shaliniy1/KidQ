"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getTaxonomy } from "@/services/parent-config";
import { submitOnboarding, type OnboardingChild } from "@/services/child-profile";
import { MASCOT_COLORS, mascotColorForIndex, type MascotColorId } from "@/lib/mascot-colors";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Avatar } from "@/components/Avatar";

const MAX_CHILDREN = 6;

interface AgeBandOption {
  key: string;
  label: string;
}

type AgeBand = OnboardingChild["age_band"];

interface DraftChild {
  nickname: string;
  ageBand: AgeBand | null;
  // Mascot color is a client-only convenience — there's no backend field for
  // it yet (see INTEGRATION_NOTES.md's lavender-token gap).
  mascotColor: MascotColorId;
}

function newChild(index: number): DraftChild {
  return { nickname: "", ageBand: null, mascotColor: mascotColorForIndex(index) };
}

function nextMascotColor(current: MascotColorId): MascotColorId {
  const index = MASCOT_COLORS.findIndex((mascot) => mascot.id === current);
  return MASCOT_COLORS[(index + 1) % MASCOT_COLORS.length].id;
}

/** P2 Screen 1 — mandatory: parent name, and per child a nickname + age band (spec Section 1). */
export default function ChildProfilePage() {
  const router = useRouter();
  const status = useSession();
  const [phase, setPhase] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [ageBands, setAgeBands] = useState<AgeBandOption[]>([]);
  const [parentName, setParentName] = useState("");
  const [children, setChildren] = useState<DraftChild[]>([newChild(0)]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    getTaxonomy()
      .then((taxonomy) => {
        const bands = (taxonomy.age_group ?? []).map((term) => ({ key: term.key, label: term.label }));
        setAgeBands(bands);
        setPhase("ready");
      })
      .catch((error) => {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load age bands");
      });
  }, [status]);

  function setChildCount(count: number) {
    const bounded = Math.max(1, Math.min(MAX_CHILDREN, count));
    setChildren((current) => {
      if (bounded === current.length) return current;
      if (bounded < current.length) return current.slice(0, bounded);
      const additions = Array.from({ length: bounded - current.length }, (_, i) => newChild(current.length + i));
      return [...current, ...additions];
    });
  }

  function updateChild(index: number, patch: Partial<DraftChild>) {
    setChildren((current) => current.map((child, i) => (i === index ? { ...child, ...patch } : child)));
  }

  const isValid =
    parentName.trim().length > 0 &&
    children.every((child) => child.nickname.trim().length > 0 && child.ageBand !== null);

  async function handleContinue() {
    if (!isValid) return;
    setPhase("submitting");
    setErrorMessage(null);
    try {
      await submitOnboarding(
        parentName.trim(),
        children.map((child) => ({ nickname: child.nickname.trim(), age_band: child.ageBand! })),
      );
      router.push("/onboarding/confirm");
    } catch (error) {
      setPhase("ready");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't save your profile");
    }
  }

  if (phase === "loading") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--kq-text-secondary)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
      <Card style={{ maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", gap: 24, height: "fit-content" }}>
        <button
          onClick={() => router.push("/onboarding/consent")}
          aria-label="Back"
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
        >
          ← Back
        </button>

        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          Tell us about your family
        </h1>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>Your name</span>
          <input
            value={parentName}
            onChange={(event) => setParentName(event.target.value)}
            placeholder="Parent name"
            style={{
              height: "var(--kq-tap-min)",
              borderRadius: "var(--kq-radius-control)",
              border: "2px solid var(--kq-border)",
              padding: "0 14px",
              fontSize: "var(--kq-text-body)",
              fontFamily: "var(--kq-font-body)",
            }}
          />
        </label>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>Number of children</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setChildCount(children.length - 1)}
              disabled={children.length <= 1}
              aria-label="Fewer children"
              style={{ width: 36, height: 36, borderRadius: "var(--kq-radius-pill)", border: "2px solid var(--kq-border)", background: "var(--kq-white)", cursor: "pointer", fontSize: 18 }}
            >
              −
            </button>
            <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{children.length}</span>
            <button
              onClick={() => setChildCount(children.length + 1)}
              disabled={children.length >= MAX_CHILDREN}
              aria-label="More children"
              style={{ width: 36, height: 36, borderRadius: "var(--kq-radius-pill)", border: "2px solid var(--kq-border)", background: "var(--kq-white)", cursor: "pointer", fontSize: 18 }}
            >
              +
            </button>
          </div>
        </div>

        {children.map((child, index) => (
          <div key={index} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12, borderTop: "1px solid var(--kq-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => updateChild(index, { mascotColor: nextMascotColor(child.mascotColor) })}
                aria-label="Change mascot color"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: "var(--kq-radius-pill)" }}
              >
                <Avatar color={child.mascotColor} label={(child.nickname[0] || "?").toUpperCase()} size={48} />
              </button>
              <input
                value={child.nickname}
                onChange={(event) => updateChild(index, { nickname: event.target.value })}
                placeholder={`Child ${index + 1}'s nickname`}
                style={{
                  flex: 1,
                  height: "var(--kq-tap-min)",
                  borderRadius: "var(--kq-radius-control)",
                  border: "2px solid var(--kq-border)",
                  padding: "0 14px",
                  fontSize: "var(--kq-text-body)",
                  fontFamily: "var(--kq-font-body)",
                }}
              />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ageBands.map((band) => (
                <Pill key={band.key} selected={child.ageBand === band.key} onClick={() => updateChild(index, { ageBand: band.key as AgeBand })}>
                  {band.label}
                </Pill>
              ))}
            </div>
          </div>
        ))}

        {errorMessage && <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>}

        <Button variant="primary" disabled={!isValid || phase === "submitting"} onClick={handleContinue}>
          {phase === "submitting" ? "Saving…" : "Continue"}
        </Button>
      </Card>
    </main>
  );
}
