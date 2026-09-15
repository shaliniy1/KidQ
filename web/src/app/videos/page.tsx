"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getChildren } from "@/services/child-profile";
import { getLibrary, removeFromLibrary, type LibraryEntry } from "@/services/my-videos";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

/**
 * P9 My Videos — the parent's own library for a child (spec Section 7).
 * Defaults to the first child in a single-child household; a real
 * multi-child household needs a switcher, matching /session's pattern.
 */
export default function MyVideosPage() {
  const router = useRouter();
  const status = useSession();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [childId, setChildId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    getChildren()
      .then(async (children) => {
        const first = children[0];
        if (!first) {
          setPhase("ready");
          return;
        }
        setChildId(first.id);
        const library = await getLibrary(first.id);
        setEntries(library);
        setPhase("ready");
      })
      .catch((error) => {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load your videos");
      });
  }, [status]);

  async function handleRemove(contentItemId: string) {
    if (!childId) return;
    setEntries((current) => current.filter((e) => e.card.id !== contentItemId)); // optimistic
    setOpenMenuId(null);
    try {
      await removeFromLibrary(childId, contentItemId);
    } catch {
      // best-effort — a failed remove just requires a page refresh to reappear
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
          <Card key={entry.card.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{entry.card.title}</p>
                <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                  {entry.card.duration_seconds ? `${Math.round(entry.card.duration_seconds / 60)} min · ` : ""}
                  {entry.state === "REQUESTED" ? "Pending KidQ review" : "In your library"}
                </p>
              </div>
              <button
                onClick={() => setOpenMenuId(openMenuId === entry.card.id ? null : entry.card.id)}
                aria-label="More options"
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--kq-text-secondary)", padding: 4 }}
              >
                ···
              </button>
            </div>

            {openMenuId === entry.card.id && (
              <button
                onClick={() => handleRemove(entry.card.id)}
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
