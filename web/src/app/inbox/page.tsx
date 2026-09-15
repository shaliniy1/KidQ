"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getInbox, type InboxNotification } from "@/services/inbox";
import { Card } from "@/components/Card";

const OUTCOME_LABELS: Record<string, string> = {
  COMPLETED: "Completed",
  EXITED: "Ended early",
};

/**
 * P8a Session-Complete Notification, rendered as an inbox — surfaced on
 * next app open (spec Section 5 / Table B #12), not a push notification.
 * Copy stays neutral and factual throughout, per spec's existing
 * behavioral-precaution rules.
 *
 * NOTE: submission approved/rejected notifications (P9b/P9b-reject) have no
 * real backend push yet — see web/src/services/inbox.ts.
 */
export default function InboxPage() {
  const router = useRouter();
  const status = useSession();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    // The inbox is derived from every child's session log; a real /inbox
    // endpoint would do this server-side. Good enough for a single-child
    // household, which is the common case today.
    const childId = new URLSearchParams(window.location.search).get("childId");
    if (!childId) {
      setPhase("ready");
      return;
    }
    getInbox(childId)
      .then((fetched) => {
        setNotifications(fetched);
        setPhase("ready");
      })
      .catch((error) => {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load notifications");
      });
  }, [status]);

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
          onClick={() => router.push("/session")}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
        >
          ← Back
        </button>

        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          Notifications
        </h1>

        {phase === "error" && <p style={{ color: "var(--kq-terracotta)" }}>{errorMessage}</p>}
        {notifications.length === 0 && phase === "ready" && (
          <p style={{ color: "var(--kq-text-secondary)" }}>Nothing yet.</p>
        )}

        {notifications.map((notification) => {
          const isExpanded = expandedId === notification.id;
          const { session } = notification;
          return (
            <Card key={notification.id} style={{ cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : notification.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>Session finished — {session.minutes} min</p>
                <span style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                  {session.ended_at ? new Date(session.ended_at).toLocaleDateString() : ""}
                </span>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                    How it ended: {session.outcome ? (OUTCOME_LABELS[session.outcome] ?? session.outcome) : "In progress"}
                  </p>
                  <p style={{ fontSize: "var(--kq-text-caption)", fontWeight: 700, color: "var(--kq-charcoal)" }}>Watched:</p>
                  {session.slots.flatMap((slot) => slot.items).map((item) => (
                    <p key={item.id} style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                      {item.card.title} · {item.card.duration_seconds ? Math.round(item.card.duration_seconds / 60) : "?"} min
                    </p>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
