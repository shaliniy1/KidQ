"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { KidQUser } from "@/services/auth";
import { onAuthChange } from "@/services/auth";
import { addToLibrary, getRecommendations } from "@/services/recommendations";
import type { RecommendationCard } from "@/types/recommendation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

/**
 * P5 Recommendation Screen. Reachable both from the normal recommendation
 * flow and directly via "Browse and pick myself" on P2-confirm (ticket 04),
 * skipping preference-tagging (spec Section 11 #16.1).
 */
export default function RecommendationsPage() {
  const router = useRouter();
  const params = useParams<{ childId: string }>();
  const childId = params.childId;

  const [phase, setPhase] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [cards, setCards] = useState<RecommendationCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
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
        const fetched = await getRecommendations(user, childId);
        setCards(fetched);
        // Every card defaults to selected (spec Section 11 #24).
        setSelected(new Set(fetched.map((card) => card.contentId)));
        setPhase("ready");
      } catch (error) {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load recommendations");
      }
    });
    return unsubscribe;
  }, [router, childId]);

  function toggleSelected(contentId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });
  }

  async function handleAddToLibrary() {
    if (!userRef.current || selected.size === 0) return;
    setPhase("submitting");
    setErrorMessage(null);
    try {
      await addToLibrary(userRef.current, childId, Array.from(selected));
      router.push("/session");
    } catch (error) {
      setPhase("ready");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't add to library");
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
      <div style={{ maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
        <button
          onClick={() => router.push("/onboarding/confirm")}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
        >
          ← Back
        </button>

        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          Made for your child
        </h1>

        {phase === "error" && <p style={{ color: "var(--kq-terracotta)" }}>{errorMessage}</p>}
        {cards.length === 0 && phase === "ready" && (
          <p style={{ color: "var(--kq-text-secondary)" }}>No recommendations available yet.</p>
        )}

        {cards.map((card) => {
          const isSelected = selected.has(card.contentId);
          const isExpanded = expandedCardId === card.contentId;
          return (
            <Card
              key={card.contentId}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                border: isSelected ? "2px solid var(--kq-teal)" : "2px solid transparent",
                cursor: "pointer",
              }}
              onClick={() => toggleSelected(card.contentId)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{card.title}</p>
                  <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                    {card.category} · {card.durationSeconds ? Math.round(card.durationSeconds / 60) : "?"} min
                  </p>
                </div>
                <span style={{ fontSize: 20 }}>{isSelected ? "✅" : "⬜"}</span>
              </div>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setExpandedCardId(isExpanded ? null : card.contentId);
                }}
                style={{
                  alignSelf: "flex-start",
                  fontSize: "var(--kq-text-caption)",
                  fontWeight: 800,
                  color: "var(--kq-teal)",
                  background: "var(--kq-card-mint)",
                  border: "none",
                  borderRadius: "var(--kq-radius-pill)",
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                ✓ {card.trustBadge}
              </button>

              {isExpanded && (
                <div style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", background: "var(--kq-cream)", borderRadius: "var(--kq-radius-control)", padding: 10 }}>
                  <p>{card.kidqSummary}</p>
                  <p style={{ marginTop: 6, fontStyle: "italic" }}>
                    Detailed pacing / language / content / visual / audio breakdown isn&apos;t
                    available yet — coming with the full scoring engine.
                  </p>
                </div>
              )}
            </Card>
          );
        })}

        {errorMessage && phase !== "error" && (
          <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>
        )}

        {cards.length > 0 && (
          <Button variant="primary" disabled={phase === "submitting"} onClick={handleAddToLibrary}>
            {phase === "submitting" ? "Adding…" : "Looks good — Add to Library"}
          </Button>
        )}
      </div>
    </main>
  );
}
