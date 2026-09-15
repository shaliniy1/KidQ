"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getChildren } from "@/services/child-profile";
import { previewVideo, submitVideo, type SubmissionPreview } from "@/services/my-videos";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

/**
 * P9a Add a Video — preview -> KidQ check -> submit (spec Section 7). The
 * real API scores submissions asynchronously (KidQ check + admin review)
 * before they're playable; there's no parent-set category or
 * public/private visibility on the real submission contract, so this is
 * simpler than PR #15's version — see api/src/http/schemas.ts
 * submissionBody/submissionPreviewSchema.
 */
export default function AddVideoPage() {
  const router = useRouter();
  const status = useSession();
  const [childId, setChildId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "previewing" | "previewed" | "submitting" | "submitted" | "error">("idle");
  const [preview, setPreview] = useState<SubmissionPreview | null>(null);
  const [badgeExpanded, setBadgeExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    getChildren().then((children) => setChildId(children[0]?.id ?? null));
  }, [status]);

  async function handlePreview() {
    if (!url.trim() || !childId) return;
    setPhase("previewing");
    setErrorMessage(null);
    try {
      const result = await previewVideo(childId, url.trim());
      setPreview(result);
      setPhase("previewed");
    } catch (error) {
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't check that video");
    }
  }

  async function handleSubmit() {
    if (!preview || !childId) return;
    setPhase("submitting");
    setErrorMessage(null);
    try {
      await submitVideo(childId, url.trim());
      setPhase("submitted");
    } catch (error) {
      setPhase("previewed");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't submit that video");
    }
  }

  if (phase === "submitted") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
        <Card style={{ maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}>
          <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
            Submitted for review
          </h1>
          <p style={{ color: "var(--kq-text-secondary)" }}>
            KidQ is scoring this video now; an admin reviews it before it&apos;s playable. Check My
            Videos for its status.
          </p>
          <Button variant="primary" onClick={() => router.push("/videos")}>
            Back to My Videos
          </Button>
        </Card>
      </main>
    );
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

        {phase !== "previewed" && phase !== "submitting" && (
          <Button variant="primary" disabled={!url.trim() || phase === "previewing" || !childId} onClick={handlePreview}>
            {phase === "previewing" ? "Looking it up…" : "Check this video"}
          </Button>
        )}

        {errorMessage && <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>}

        {preview && (phase === "previewed" || phase === "submitting") && (
          <>
            <div style={{ borderTop: "1px solid var(--kq-border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{preview.title}</p>
              <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                {preview.channel ?? "Unknown channel"}
                {preview.duration_seconds ? ` · ${Math.round(preview.duration_seconds / 60)} min` : ""}
                {preview.category ? ` · ${preview.category}` : ""}
              </p>

              {preview.already_in_kidq && (
                <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-teal)" }}>Already in KidQ&apos;s library.</p>
              )}

              <button
                onClick={() => setBadgeExpanded(!badgeExpanded)}
                style={{ alignSelf: "flex-start", fontSize: "var(--kq-text-caption)", fontWeight: 800, color: "var(--kq-teal)", background: "var(--kq-card-mint)", border: "none", borderRadius: "var(--kq-radius-pill)", padding: "4px 10px", cursor: "pointer" }}
              >
                ✓ {preview.kidq_check.status === "REVIEWED" ? "KidQ reviewed" : "Checking…"}
              </button>
              {badgeExpanded && (
                <div style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                  {preview.kidq_check.note && <p style={{ fontStyle: "italic" }}>{preview.kidq_check.note}</p>}
                  {preview.kidq_check.dimensions.map((dimension) => (
                    <p key={dimension.key} style={{ marginTop: 4 }}>
                      <strong>{dimension.label}:</strong> {dimension.summary}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
              Submitting sends this for KidQ&apos;s AI check and an admin&apos;s review before it&apos;s
              playable for your family.
            </p>

            <Button variant="primary" disabled={phase === "submitting"} onClick={handleSubmit}>
              {phase === "submitting" ? "Submitting…" : "Submit for review"}
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
