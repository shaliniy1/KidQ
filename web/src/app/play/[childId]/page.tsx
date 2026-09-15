"use client";

/**
 * Child Player — out of scope for these 15 tickets (spec P1 inventory:
 * "existing, unchanged screens; gains one business-logic note in Section 4
 * — session starts live on handoff"). This stub exists only as a landing
 * target for P7a's "Start session" action, and shows the real assembled
 * queue (read from the sessionStorage bridge P7a wrote) so the full
 * Session Assembly pipeline is visibly provable end-to-end, not just a
 * blank landing page. "End session" calls the real session-end endpoint —
 * standing in for the real Child Player, which would call it automatically
 * when a session actually ends.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { endSession, type AssembledSession } from "@/services/session";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export default function ChildPlayerStub() {
  const router = useRouter();
  const params = useParams<{ childId: string }>();
  const [session, setSession] = useState<AssembledSession | null>(null);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`kidq:last-session:${params.childId}`);
      if (raw) setSession(JSON.parse(raw) as AssembledSession);
    } catch {
      // no session to show — fine, this is a stub
    }
  }, [params.childId]);

  async function handleEndSession(outcome: "COMPLETED" | "EXITED") {
    if (!session) return;
    setLogging(true);
    try {
      await endSession(session.id, outcome);
      router.push(`/inbox?childId=${params.childId}`);
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
              {session.minutes} min · {session.mode} · {session.time_band ?? "—"}
              {session.short_by_minutes > 0 && ` · ${session.short_by_minutes} min short of the library`}
            </p>
            {session.slots.map((slot) => (
              <div key={slot.slot} style={{ borderTop: "1px solid var(--kq-border)", paddingTop: 10 }}>
                <p style={{ fontWeight: 700, fontSize: "var(--kq-text-caption)", color: "var(--kq-charcoal)" }}>
                  Slot {slot.slot + 1}
                </p>
                {slot.items.length === 0 && (
                  <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-terracotta)" }}>No content available</p>
                )}
                {slot.items.map((item) => (
                  <p key={item.id} style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                    {item.card.title} · {item.card.category} ·{" "}
                    {item.card.duration_seconds ? Math.round(item.card.duration_seconds / 60) : "?"} min
                  </p>
                ))}
                {slot.break_activity && (
                  <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-teal)", fontStyle: "italic" }}>
                    Break: {slot.break_activity.title}
                  </p>
                )}
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Button variant="primary" disabled={logging} onClick={() => handleEndSession("COMPLETED")}>
                {logging ? "…" : "End session (completed)"}
              </Button>
              <Button variant="secondary" disabled={logging} onClick={() => handleEndSession("EXITED")}>
                End early
              </Button>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
