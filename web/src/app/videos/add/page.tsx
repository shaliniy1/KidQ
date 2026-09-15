"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { onAuthChange } from "@/services/auth";
import { addVideo, detectVideo } from "@/services/my-videos";
import { getCategories } from "@/services/parent-config";
import type { DetectedVideo, LibraryVisibility } from "@/types/library";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";

const OTHER_CATEGORY = "Other";

/**
 * P9a Add a Video — updated flow: auto-detect -> score badge -> review ->
 * add (spec Section 7). The score is informational only; even a low or
 * missing result never blocks Add Content.
 */
export default function AddVideoPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "detecting" | "detected" | "adding" | "error">("idle");
  const [detected, setDetected] = useState<DetectedVideo | null>(null);
  const [badgeExpanded, setBadgeExpanded] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      userRef.current = user;
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    getCategories()
      .then((response) => setCategories(response.categories))
      .catch(() => setCategories([]));
  }, []);

  async function handleDetect() {
    if (!url.trim() || !userRef.current) return;
    setPhase("detecting");
    setErrorMessage(null);
    setSelectedCategory(null);
    try {
      const result = await detectVideo(userRef.current, url.trim());
      setDetected(result);
      setPhase("detected");
    } catch (error) {
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't detect that video");
    }
  }

  async function handleAddContent() {
    if (!detected || !userRef.current || !selectedCategory) return;
    setPhase("adding");
    setErrorMessage(null);
    try {
      const visibility: LibraryVisibility = isPublic ? "public" : "private";
      await addVideo(userRef.current, detected, selectedCategory, visibility);
      router.push("/videos");
    } catch (error) {
      setPhase("detected");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't add that video");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
      <Card style={{ maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 18, height: "fit-content" }}>
        <button
          onClick={() => router.push("/videos")}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
        >
          ← Back
        </button>

        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          Add a video
        </h1>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>YouTube URL</span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            style={{ height: "var(--kq-tap-min)", borderRadius: "var(--kq-radius-control)", border: "2px solid var(--kq-border)", padding: "0 14px", fontSize: "var(--kq-text-body)", fontFamily: "var(--kq-font-body)" }}
          />
        </label>

        {phase !== "detected" && phase !== "adding" && (
          <Button variant="primary" disabled={!url.trim() || phase === "detecting"} onClick={handleDetect}>
            {phase === "detecting" ? "Looking it up…" : "Detect video"}
          </Button>
        )}

        {errorMessage && <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>}

        {detected && (phase === "detected" || phase === "adding") && (
          <>
            <div style={{ borderTop: "1px solid var(--kq-border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{detected.title}</p>
              <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                {detected.channel ?? "Unknown channel"}
                {detected.durationSeconds ? ` · ${Math.round(detected.durationSeconds / 60)} min` : ""}
              </p>

              <button
                onClick={() => setBadgeExpanded(!badgeExpanded)}
                style={{ alignSelf: "flex-start", fontSize: "var(--kq-text-caption)", fontWeight: 800, color: "var(--kq-teal)", background: "var(--kq-card-mint)", border: "none", borderRadius: "var(--kq-radius-pill)", padding: "4px 10px", cursor: "pointer" }}
              >
                ✓ {detected.trustBadge}
              </button>
              {badgeExpanded && (
                <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", fontStyle: "italic" }}>
                  Detailed pacing / language / content / visual / audio breakdown isn&apos;t
                  available yet — coming with the full scoring engine. This never blocks
                  adding the video.
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                What category is this? KidQ can&apos;t detect this automatically yet — pick the
                closest fit.
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[...categories, OTHER_CATEGORY].map((category) => (
                  <Pill key={category} selected={selectedCategory === category} onClick={() => setSelectedCategory(category)}>
                    {category}
                  </Pill>
                ))}
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--kq-teal)" }} />
              <span style={{ fontSize: "var(--kq-text-body)", color: "var(--kq-charcoal)" }}>Also suggest this to other families</span>
            </label>
            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
              Either way, this video is usable by your family right away — no approval needed.
            </p>

            <Button variant="primary" disabled={phase === "adding" || !selectedCategory} onClick={handleAddContent}>
              {phase === "adding" ? "Adding…" : "Add Content"}
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
