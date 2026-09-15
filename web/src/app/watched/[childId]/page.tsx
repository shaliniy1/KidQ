"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getChildren, type ChildProfile } from "@/services/child-profile";
import { getWatchedLog } from "@/services/watched-log";
import { Card } from "@/components/Card";

interface Row {
  sessionId: string;
  loggedAt: string | null;
  contentId: string;
  title: string;
  durationSeconds: number | null;
}

/**
 * P8 Handoff & Insight Tray — the factual watched-content log.
 *
 * NOTE: per-video 👍/👎 feedback and "stop recommending this to this child"
 * have no real backend endpoint yet (see web/src/services/watched-log.ts) —
 * shown here as disabled affordances rather than silently fake actions.
 */
export default function WatchedLogPage() {
  const router = useRouter();
  const status = useSession();
  const params = useParams<{ childId: string }>();
  const childId = params.childId;

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    Promise.all([getChildren(), getWatchedLog(childId)])
      .then(([children, sessions]) => {
        setChild(children.find((c) => c.id === childId) ?? null);
        setRows(
          sessions.flatMap((session) =>
            session.slots.flatMap((slot) =>
              slot.items.map((item) => ({
                sessionId: session.id,
                loggedAt: session.ended_at,
                contentId: item.card.id,
                title: item.card.title,
                durationSeconds: item.card.duration_seconds,
              })),
            ),
          ),
        );
        setPhase("ready");
      })
      .catch((error) => {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load the watched log");
      });
  }, [status, childId]);

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

        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          {child ? `${child.nickname}'s watched videos` : "Watched videos"}
        </h1>

        {phase === "error" && <p style={{ color: "var(--kq-terracotta)" }}>{errorMessage}</p>}
        {rows.length === 0 && phase === "ready" && <p style={{ color: "var(--kq-text-secondary)" }}>Nothing watched yet.</p>}

        {rows.map((row, index) => (
          <Card key={`${row.sessionId}-${row.contentId}-${index}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{row.title}</p>
                <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                  {row.durationSeconds ? `${Math.round(row.durationSeconds / 60)} min` : ""}
                  {row.loggedAt ? ` · ${new Date(row.loggedAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  disabled
                  title="Per-video feedback isn't available yet"
                  aria-label="Thumbs up (not yet available)"
                  style={{ fontSize: 18, background: "none", border: "none", borderRadius: "var(--kq-radius-pill)", padding: 6, opacity: 0.4, cursor: "not-allowed" }}
                >
                  👍
                </button>
                <button
                  disabled
                  title="Per-video feedback isn't available yet"
                  aria-label="Thumbs down (not yet available)"
                  style={{ fontSize: 18, background: "none", border: "none", borderRadius: "var(--kq-radius-pill)", padding: 6, opacity: 0.4, cursor: "not-allowed" }}
                >
                  👎
                </button>
              </div>
            </div>
            <button
              disabled
              title="Per-child exclude isn't available yet"
              style={{ alignSelf: "flex-start", fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", textDecoration: "underline", background: "none", border: "none", cursor: "not-allowed", padding: 0, opacity: 0.5 }}
            >
              Remove from {child?.nickname ?? "this child"}&apos;s videos
            </button>
          </Card>
        ))}
      </div>
    </main>
  );
}
