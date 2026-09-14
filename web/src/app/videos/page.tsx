"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { onAuthChange, fetchSessionRouting } from "@/services/auth";
import { getMyVideos, removeVideo, simulateAdminDecision } from "@/services/my-videos";
import type { LibraryEntry } from "@/types/library";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

function tagLabel(entry: LibraryEntry, parentName: string | null): string {
  const name = parentName ?? "you";
  if (entry.tag === "kidq_recommended") return "KidQ recommended";
  if (entry.visibility === "public" && entry.submissionStatus === "approved") {
    return `Admin-approved, suggested by ${name}`;
  }
  return `Picked by ${name}`;
}

/** P9 My Videos — the parent's own shared video library (spec Section 7). */
export default function MyVideosPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [parentName, setParentName] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      userRef.current = user;
      try {
        const [videos, routing] = await Promise.all([getMyVideos(user), fetchSessionRouting(user)]);
        setEntries(videos);
        setParentName(routing.parentName);
        setPhase("ready");
      } catch (error) {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load your videos");
      }
    });
    return unsubscribe;
  }, [router]);

  async function handleRemove(entryId: string) {
    if (!userRef.current) return;
    setEntries((current) => current.filter((e) => e.id !== entryId)); // optimistic
    setOpenMenuId(null);
    try {
      await removeVideo(userRef.current, entryId);
    } catch {
      // best-effort for this prototype — a failed remove just requires a page refresh to reappear
    }
  }

  async function handleSimulateDecision(entryId: string, decision: "approved" | "rejected") {
    if (!userRef.current) return;
    await simulateAdminDecision(userRef.current, entryId, decision);
    const refreshed = await getMyVideos(userRef.current);
    setEntries(refreshed);
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
      <div style={{ maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        <button
          onClick={() => router.push("/session")}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
        >
          ← Back
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
            My Videos
          </h1>
          <Button variant="secondary" onClick={() => router.push("/videos/add")}>
            + Add a video
          </Button>
        </div>

        {phase === "error" && <p style={{ color: "var(--kq-terracotta)" }}>{errorMessage}</p>}
        {entries.length === 0 && phase === "ready" && <p style={{ color: "var(--kq-text-secondary)" }}>No videos yet.</p>}

        {entries.map((entry) => (
          <Card key={entry.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{entry.title}</p>
                <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                  {entry.durationSeconds ? `${Math.round(entry.durationSeconds / 60)} min · ` : ""}
                  {tagLabel(entry, parentName)}
                </p>
              </div>
              <button
                onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
                aria-label="More options"
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--kq-text-secondary)", padding: 4 }}
              >
                ···
              </button>
            </div>

            {entry.visibility === "public" && entry.submissionStatus === "pending" && (
              <div style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                Pending admin review.{" "}
                <button onClick={() => handleSimulateDecision(entry.id, "approved")} style={{ color: "var(--kq-teal)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "inherit" }}>
                  (test) simulate approve
                </button>{" "}
                ·{" "}
                <button onClick={() => handleSimulateDecision(entry.id, "rejected")} style={{ color: "var(--kq-teal)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "inherit" }}>
                  simulate reject
                </button>
              </div>
            )}

            {openMenuId === entry.id && (
              <button
                onClick={() => handleRemove(entry.id)}
                style={{ alignSelf: "flex-start", color: "var(--kq-terracotta)", background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontSize: "var(--kq-text-caption)", fontWeight: 700 }}
              >
                Remove
              </button>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
