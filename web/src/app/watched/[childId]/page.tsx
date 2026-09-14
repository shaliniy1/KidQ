"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { onAuthChange } from "@/services/auth";
import { getChildren } from "@/services/child-profile";
import { excludeFromChild, getFeedback, getWatchedLog, setFeedback } from "@/services/watched-log";
import type { ChildProfile } from "@/types/child-profile";
import type { Sentiment, SessionLogRecord } from "@/types/watched-log";
import { Card } from "@/components/Card";

interface Row {
  sessionId: string;
  loggedAt: string;
  contentId: string;
  title: string;
  durationSeconds: number;
}

function toRows(logs: SessionLogRecord[]): Row[] {
  return logs.flatMap((log) =>
    log.watched.map((video) => ({
      sessionId: log.id,
      loggedAt: log.loggedAt,
      contentId: video.contentId,
      title: video.title,
      durationSeconds: video.durationSeconds,
    }))
  );
}

/**
 * P8 Handoff & Insight Tray — the factual watched-content log, with
 * optimistic 👍/👎 and per-child "stop recommending this".
 */
export default function WatchedLogPage() {
  const router = useRouter();
  const params = useParams<{ childId: string }>();
  const childId = params.childId;

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sentiments, setSentiments] = useState<Record<string, Sentiment>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
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
        const [children, logs, feedback] = await Promise.all([
          getChildren(user),
          getWatchedLog(user, childId),
          getFeedback(user),
        ]);
        setChild(children.find((c) => c.id === childId) ?? null);
        setRows(toRows(logs));
        const sentimentMap: Record<string, Sentiment> = {};
        for (const entry of feedback) sentimentMap[entry.contentId] = entry.sentiment;
        setSentiments(sentimentMap);
        setPhase("ready");
      } catch (error) {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load the watched log");
      }
    });
    return unsubscribe;
  }, [router, childId]);

  async function handleThumb(contentId: string, sentiment: Sentiment) {
    if (!userRef.current) return;
    setSentiments((current) => ({ ...current, [contentId]: sentiment })); // optimistic
    try {
      await setFeedback(userRef.current, contentId, sentiment);
    } catch {
      // best-effort: the optimistic state just stays as-is on failure for this prototype
    }
  }

  async function handleRemove(contentId: string) {
    if (!userRef.current) return;
    setExcluded((current) => new Set(current).add(contentId)); // optimistic
    try {
      await excludeFromChild(userRef.current, childId, contentId);
    } catch {
      setExcluded((current) => {
        const next = new Set(current);
        next.delete(contentId);
        return next;
      });
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

        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          {child ? `${child.nickname}'s watched videos` : "Watched videos"}
        </h1>

        {phase === "error" && <p style={{ color: "var(--kq-terracotta)" }}>{errorMessage}</p>}
        {rows.length === 0 && phase === "ready" && <p style={{ color: "var(--kq-text-secondary)" }}>Nothing watched yet.</p>}

        {rows.map((row, index) => (
          <Card key={`${row.sessionId}-${row.contentId}-${index}`} style={{ display: "flex", flexDirection: "column", gap: 8, opacity: excluded.has(row.contentId) ? 0.5 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{row.title}</p>
                <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                  {Math.round(row.durationSeconds / 60)} min · {new Date(row.loggedAt).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => handleThumb(row.contentId, "up")}
                  aria-label="Thumbs up"
                  style={{ fontSize: 18, background: sentiments[row.contentId] === "up" ? "var(--kq-card-mint)" : "none", border: "none", borderRadius: "var(--kq-radius-pill)", padding: 6, cursor: "pointer" }}
                >
                  👍
                </button>
                <button
                  onClick={() => handleThumb(row.contentId, "down")}
                  aria-label="Thumbs down"
                  style={{ fontSize: 18, background: sentiments[row.contentId] === "down" ? "var(--kq-card-peach)" : "none", border: "none", borderRadius: "var(--kq-radius-pill)", padding: 6, cursor: "pointer" }}
                >
                  👎
                </button>
              </div>
            </div>
            <button
              onClick={() => handleRemove(row.contentId)}
              disabled={excluded.has(row.contentId)}
              style={{ alignSelf: "flex-start", fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {excluded.has(row.contentId) ? "Removed from future recommendations" : `Remove from ${child?.nickname ?? "this child"}'s videos`}
            </button>
          </Card>
        ))}
      </div>
    </main>
  );
}
