"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { onAuthChange } from "@/services/auth";
import { getInbox, markNotificationRead } from "@/services/inbox";
import type { InboxNotification } from "@/types/inbox";
import { Card } from "@/components/Card";

const OUTCOME_LABELS: Record<string, string> = {
  completed: "Completed",
  skipped: "Skipped",
  exited: "Ended early",
};

function summaryFor(notification: InboxNotification): string {
  switch (notification.type) {
    case "session_complete":
      return `Session finished — ${notification.payload.durationMinutes} min`;
    case "submission_approved":
      return `${notification.payload.title} was approved`;
    case "submission_rejected":
      return `Update on ${notification.payload.title}`;
  }
}

/**
 * P8a Session-Complete Notification (+ P9b / P9b-reject, ticket 11),
 * rendered as an inbox — surfaced on next app open (spec Section 5 /
 * Table B #12), not a push notification. Copy stays neutral and factual
 * throughout, per spec's existing behavioral-precaution rules.
 */
export default function InboxPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
        const fetched = await getInbox(user);
        setNotifications(fetched);
        setPhase("ready");
      } catch (error) {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load notifications");
      }
    });
    return unsubscribe;
  }, [router]);

  async function handleOpen(notification: InboxNotification) {
    setExpandedId(expandedId === notification.id ? null : notification.id);
    if (!notification.read && userRef.current) {
      await markNotificationRead(userRef.current, notification.id);
      setNotifications((current) => current.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
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
          return (
            <Card key={notification.id} style={{ cursor: "pointer" }} onClick={() => handleOpen(notification)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontWeight: notification.read ? 600 : 800, color: "var(--kq-charcoal)" }}>
                  {!notification.read && <span style={{ color: "var(--kq-saffron)" }}>● </span>}
                  {summaryFor(notification)}
                </p>
                <span style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                  {new Date(notification.createdAt).toLocaleDateString()}
                </span>
              </div>

              {isExpanded && notification.type === "session_complete" && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                    How it ended: {OUTCOME_LABELS[notification.payload.outcome] ?? notification.payload.outcome}
                  </p>
                  <p style={{ fontSize: "var(--kq-text-caption)", fontWeight: 700, color: "var(--kq-charcoal)" }}>
                    Watched:
                  </p>
                  {notification.payload.watched.map((video, index) => (
                    <p key={index} style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                      {video.title} · {Math.round(video.durationSeconds / 60)} min
                    </p>
                  ))}
                  {notification.payload.thinPoolDisclosure && (
                    <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-terracotta)", marginTop: 6 }}>
                      {notification.payload.thinPoolDisclosure}
                    </p>
                  )}
                </div>
              )}

              {isExpanded && notification.type === "submission_approved" && (
                <p style={{ marginTop: 10, fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                  Thank you for the recommendation — {notification.payload.title} is now approved and may be
                  suggested to other families too.
                </p>
              )}

              {isExpanded && notification.type === "submission_rejected" && (
                <p style={{ marginTop: 10, fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                  We won&apos;t be suggesting {notification.payload.title} to other families right now. It&apos;s
                  still available in your own library, unaffected.
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
