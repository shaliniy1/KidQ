"use client";

/**
 * Child Player — out of scope for these 15 tickets (spec P1 inventory:
 * "existing, unchanged screens; gains one business-logic note in Section 4
 * — session starts live on handoff"). This stub exists only as a landing
 * target for P7a's "Start session" action, and shows the real assembled
 * queue (read from the sessionStorage bridge P7a wrote) so the full
 * Session Assembly pipeline is visibly provable end-to-end, not just a
 * blank landing page. It also calls the real session-log ingestion
 * endpoint (ticket 09) on "End session" — standing in for the real Child
 * Player, which would call it automatically when a session actually ends.
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { onAuthChange } from "@/services/auth";
import { logSessionOutcome } from "@/services/inbox";
import type { AssembledSession } from "@/types/session";
import type { SessionOutcome } from "@/types/inbox";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export default function ChildPlayerStub() {
  const router = useRouter();
  const params = useParams<{ childId: string }>();
  const [session, setSession] = useState<AssembledSession | null>(null);
  const [outsideScheduledWindow, setOutsideScheduledWindow] = useState(false);
  const [logging, setLogging] = useState(false);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      userRef.current = user;
    });

    // sessionStorage is only readable client-side, so this can't be
    // computed during render/SSR — genuinely needs an effect. Deferred
    // past a microtask (matching the async-fetch pattern the rest of this
    // app already uses) rather than a synchronous setState in the effect
    // body itself.
    (async () => {
      await Promise.resolve();
      try {
        const raw = sessionStorage.getItem(`kidq:last-session:${params.childId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as AssembledSession & { outsideScheduledWindow?: boolean };
          setSession(parsed);
          setOutsideScheduledWindow(Boolean(parsed.outsideScheduledWindow));
        }
      } catch {
        // no session to show — fine, this is a stub
      }
    })();

    return unsubscribe;
  }, [params.childId]);

  async function handleEndSession(outcome: SessionOutcome) {
    if (!session || !userRef.current) return;
    setLogging(true);
    try {
      await logSessionOutcome(userRef.current, params.childId, session, outcome);
      router.push("/inbox");
    } finally {
      setLogging(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
      <Card style={{ maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", gap: 16, height: "fit-content" }}>
        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          Session started
        </h1>
        <p style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-caption)" }}>
          The child-facing player is an existing, unchanged screen outside this build&apos;s
          scope — this is a stand-in so the assembled queue and the session-end flow can be
          verified.
        </p>

        {!session && <p style={{ color: "var(--kq-text-secondary)" }}>No session data found.</p>}

        {session && (
          <>
            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
              {session.durationMinutes} min · every {session.breakIntervalMinutes} min ·{" "}
              {session.totalBreaks} break{session.totalBreaks === 1 ? "" : "s"} · {session.timeBand}
            </p>
            {outsideScheduledWindow && (
              <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>
                This is outside the daily schedule you saved in Settings — just a reminder,
                nothing&apos;s blocked.
              </p>
            )}
            {session.usedFallback && (
              <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>
                A couple of videos today came from a neighboring age range — content was a
                little thin in {session.fallbackCategory} this week.
              </p>
            )}
            {session.slots.map((slot) => (
              <div key={slot.index} style={{ borderTop: "1px solid var(--kq-border)", paddingTop: 10 }}>
                <p style={{ fontWeight: 700, fontSize: "var(--kq-text-caption)", color: "var(--kq-charcoal)" }}>
                  Slot {slot.index + 1}{slot.isFinalSlot ? " (wind-down)" : ""}
                </p>
                {slot.videos.length === 0 && (
                  <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-terracotta)" }}>No content available</p>
                )}
                {slot.videos.map((video) => (
                  <p key={video.contentId} style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                    {video.title} · {video.category} · {Math.round(video.durationSeconds / 60)} min
                  </p>
                ))}
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Button variant="primary" disabled={logging} onClick={() => handleEndSession("completed")}>
                {logging ? "…" : "End session (completed)"}
              </Button>
              <Button variant="secondary" disabled={logging} onClick={() => handleEndSession("exited")}>
                End early
              </Button>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
