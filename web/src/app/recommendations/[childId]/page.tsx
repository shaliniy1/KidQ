"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { addToLibrary, getRecommendations, type Recommendation } from "@/services/recommendations";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

/**
 * P5 Recommendation Screen. Reachable both from the normal recommendation
 * flow and directly via "Browse and pick myself" on P2-confirm (ticket 04),
 * skipping preference-tagging (spec Section 11 #16.1).
 */
export default function RecommendationsPage() {
  const router = useRouter();
  const status = useSession();
  const params = useParams<{ childId: string }>();
  const childId = params.childId;

  const [phase, setPhase] = useState<"loading" | "ready" | "submitting" | "error">("loading");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    getRecommendations(childId)
      .then((fetched) => {
        setRecommendations(fetched);
        // Every card defaults to selected (spec Section 11 #24).
        setSelected(new Set(fetched.map((rec) => rec.card.id)));
        setPhase("ready");
      })
      .catch((error) => {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load recommendations");
      });
  }, [status, childId]);

  function toggleSelected(contentId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });
  }

  async function handleAddToLibrary() {
    if (selected.size === 0) return;
    setPhase("submitting");
    setErrorMessage(null);
    try {
      await Promise.all(Array.from(selected).map((contentId) => addToLibrary(childId, contentId)));
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
        {recommendations.length === 0 && phase === "ready" && (
          <p style={{ color: "var(--kq-text-secondary)" }}>No recommendations available yet.</p>
        )}

        {recommendations.map((rec) => {
          const { card } = rec;
          const isSelected = selected.has(card.id);
          const isExpanded = expandedCardId === card.id;
          return (
            <Card
              key={card.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                border: isSelected ? "2px solid var(--kq-teal)" : "2px solid transparent",
                cursor: "pointer",
              }}
              onClick={() => toggleSelected(card.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{card.title}</p>
                  <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                    {card.category} · {card.duration_seconds ? Math.round(card.duration_seconds / 60) : "?"} min
                  </p>
                </div>
                <span style={{ fontSize: 20 }}>{isSelected ? "✅" : "⬜"}</span>
              </div>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setExpandedCardId(isExpanded ? null : card.id);
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
                ✓ {card.kidq_check.status === "REVIEWED" ? "KidQ reviewed" : "Checking…"}
              </button>

              {isExpanded && (
                <div style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", background: "var(--kq-cream)", borderRadius: "var(--kq-radius-control)", padding: 10 }}>
                  {card.kidq_summary && <p>{card.kidq_summary}</p>}
                  {card.kidq_check.dimensions.map((dimension) => (
                    <p key={dimension.key} style={{ marginTop: 6 }}>
                      <strong>{dimension.label}:</strong> {dimension.summary}
                    </p>
                  ))}
                  {rec.why.length > 0 && (
                    <p style={{ marginTop: 6, fontStyle: "italic" }}>{rec.why.join(" · ")}</p>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {errorMessage && phase !== "error" && (
          <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>
        )}

        {recommendations.length > 0 && (
          <Button variant="primary" disabled={phase === "submitting"} onClick={handleAddToLibrary}>
            {phase === "submitting" ? "Adding…" : "Looks good — Add to Library"}
          </Button>
        )}
      </div>
    </main>
  );
}
