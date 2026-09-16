"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getChildren } from "@/services/child-profile";
import { addToLibrary, getRecommendations, type Recommendation } from "@/services/recommendations";
import { getStory, type Story } from "@/services/story";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { KidQStoryReader } from "@kidq/player";

const AGE_BAND_LABELS: Record<string, string> = { "0_2": "0–2", "2_3": "2–3", "3_4": "3–4", "4_5": "4–5", "5_6": "5–6" };

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
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [planReady, setPlanReady] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ageLabel, setAgeLabel] = useState("your child");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [storyPreview, setStoryPreview] = useState<Story | null>(null);

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
        setOrderedIds(fetched.map((rec) => rec.card.id));
        setPhase("ready");
      })
      .catch((error) => {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load recommendations");
      });
  }, [status, childId]);

  useEffect(() => {
    if (status !== "authed") return;
    getChildren().then((children) => {
      const child = children.find((item) => item.id === childId);
      if (child) setAgeLabel(AGE_BAND_LABELS[child.age_band] ?? child.age_band);
    }).catch(() => undefined);
  }, [status, childId]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`kidq:recommendation-context:${childId}`);
      if (saved) setDuration(JSON.parse(saved).duration ?? 30);
    } catch {
      // Keep the design usable when browser storage is unavailable.
    }
  }, [childId]);

  useEffect(() => {
    const item = recommendations.find((rec) => rec.card.id === previewId)?.card;
    if (!item || item.content_type !== "STORYBOOK") {
      setStoryPreview(null);
      return;
    }
    let cancelled = false;
    getStory(item.id).then((result) => { if (!cancelled) setStoryPreview(result); }).catch(() => { if (!cancelled) setStoryPreview(null); });
    return () => { cancelled = true; };
  }, [previewId, recommendations]);

  function toggleSelected(contentId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });
  }

  function moveSelected(contentId: string, direction: -1 | 1) {
    setOrderedIds((current) => {
      const index = current.indexOf(contentId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function handleAddToLibrary() {
    if (selected.size === 0) return;
    setPhase("submitting");
    setErrorMessage(null);
    try {
      await Promise.all(orderedRecommendations.filter((rec) => selected.has(rec.card.id)).map((rec, index) => addToLibrary(childId, rec.card.id, index)));
      setPlanReady(true);
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

  if (planReady) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
        <Card style={{ maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
          <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
            Your Screen Time Plan is Ready
          </h1>
          <p style={{ color: "var(--kq-text-secondary)" }}>{selected.size} item{selected.size === 1 ? "" : "s"} ready for a {duration}-minute session.</p>
          <Button variant="primary" onClick={() => router.push("/session")}>Back to Parent space</Button>
          <button onClick={() => router.push("/kid")} style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", textDecoration: "underline", cursor: "pointer" }}>
            View kid mode
          </button>
        </Card>
      </main>
    );
  }

  const orderedRecommendations = orderedIds
    .map((id) => recommendations.find((rec) => rec.card.id === id))
    .filter((rec): rec is Recommendation => Boolean(rec));
  const selectedRecommendations = orderedRecommendations.filter((rec) => selected.has(rec.card.id));
  const totalMinutes = selectedRecommendations.reduce((total, rec) => total + Math.max(1, Math.round((rec.card.duration_seconds ?? 0) / 60)), 0);

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
          Recommendation Review
        </h1>
        <Card style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <strong style={{ color: "var(--kq-charcoal)" }}>Your Q</strong>
          <span style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-caption)" }}>Screen time: {duration} min · Current Q: {totalMinutes} min</span>
          {totalMinutes > duration && <span style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>Your Q is longer than the selected screen time.</span>}
          {selectedRecommendations.length === 0 && <span style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-caption)" }}>No content selected. Add something back below.</span>}
        </Card>

        {phase === "error" && <p style={{ color: "var(--kq-terracotta)" }}>{errorMessage}</p>}
        {recommendations.length === 0 && phase === "ready" && (
          <p style={{ color: "var(--kq-text-secondary)" }}>No recommendations available yet.</p>
        )}

        {orderedRecommendations.map((rec) => {
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
                <div style={{ width: "100%", aspectRatio: "16 / 9", height: "auto", borderRadius: "var(--kq-radius-control)", background: card.thumbnail_url ? `url(${card.thumbnail_url}) center / contain no-repeat` : "var(--kq-card-mint)" }} aria-label={`${card.title} thumbnail`} />
              <div>
                  <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{card.title}</p>
                  <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                    {card.category} · {card.duration_seconds ? Math.round(card.duration_seconds / 60) : "?"} min · age {ageLabel}
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
              <button
                onClick={(event) => { event.stopPropagation(); setStoryPreview(null); setPreviewId(card.id); }}
                style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-teal)", cursor: "pointer", textDecoration: "underline" }}
              >
                Preview content
              </button>
              {isSelected && <div style={{ display: "flex", gap: 8 }}>
                <button onClick={(event) => { event.stopPropagation(); moveSelected(card.id, -1); }} style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer" }}>↑ Reorder</button>
                <button onClick={(event) => { event.stopPropagation(); moveSelected(card.id, 1); }} style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer" }}>↓</button>
                <button onClick={(event) => { event.stopPropagation(); toggleSelected(card.id); }} style={{ background: "none", border: "none", color: "var(--kq-terracotta)", cursor: "pointer" }}>Remove</button>
              </div>}
            </Card>
          );
        })}

        {errorMessage && phase !== "error" && (
          <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>
        )}

        {recommendations.length > 0 && (
          <Button variant="primary" disabled={phase === "submitting" || selected.size === 0} onClick={handleAddToLibrary}>
            {phase === "submitting" ? "Saving…" : "Confirm Your Q"}
          </Button>
        )}
      </div>
      {previewId && (() => {
        const item = recommendations.find((rec) => rec.card.id === previewId)?.card;
        if (!item) return null;
        const previewUrl = item.player?.provider === "youtube" ? item.player.embed_url : item.player?.provider === "html5" ? item.player.media_url : null;
        return <div role="dialog" aria-modal="true" aria-label={`${item.title} preview`} style={{ position: "fixed", inset: 0, zIndex: 20, display: "grid", placeItems: "center", padding: 24, background: "rgba(46,36,24,.55)" }}><Card style={{ maxWidth: 760, width: "100%", maxHeight: "92vh", overflow: "auto", display: "flex", flexDirection: "column", gap: 14 }}><h2 className="kq-heading" style={{ color: "var(--kq-charcoal)" }}>{item.title}</h2>{item.content_type === "STORYBOOK" ? storyPreview ? <KidQStoryReader title={storyPreview.title} pages={storyPreview.pages} credits={storyPreview.credits} attribution={storyPreview.attribution} /> : <p style={{ color: "var(--kq-text-secondary)" }}>Opening the story…</p> : <div style={{ aspectRatio: "16 / 9", background: "var(--kq-charcoal)", borderRadius: "var(--kq-radius-control)", overflow: "hidden" }}>{previewUrl ? <iframe title={`${item.title} preview`} src={previewUrl} style={{ width: "100%", height: "100%", border: 0 }} allow="autoplay; encrypted-media; picture-in-picture" /> : <p style={{ color: "var(--kq-white)", padding: 24 }}>Preview is not available for this item yet.</p>}</div>}<Button variant="secondary" onClick={() => { setPreviewId(null); setStoryPreview(null); }}>Close preview</Button></Card></div>;
      })()}
    </main>
  );
}
