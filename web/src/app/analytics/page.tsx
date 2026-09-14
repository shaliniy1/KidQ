"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { onAuthChange } from "@/services/auth";
import { getChildren } from "@/services/child-profile";
import { getAnalyticsSummary } from "@/services/analytics";
import type { ChildProfile } from "@/types/child-profile";
import type { AnalyticsSummary, TimeRange } from "@/types/analytics";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Avatar } from "@/components/Avatar";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function downloadCsvExport(user: User) {
  const idToken = await user.getIdToken();
  const res = await fetch(`${API_URL}/analytics/export.csv`, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error(`Export failed with status ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "kidq-analytics-export.csv";
  link.click();
  URL.revokeObjectURL(url);
}

const RANGE_LABELS: { range: TimeRange; label: string }[] = [
  { range: "day", label: "Day" },
  { range: "week", label: "Week" },
  { range: "month", label: "Month" },
];

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

/**
 * P8b Analytics / Insight Dashboard — a friendly summary, not a raw
 * dashboard (spec's explicit reframe for this ticket). Opens on the same
 * child-switcher pattern as P7a for multi-child households.
 */
export default function AnalyticsPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("week");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
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
        const fetched = await getChildren(user);
        setChildren(fetched);
        if (fetched.length === 1) setSelectedChildId(fetched[0].id);
        setPhase("ready");
      } catch (error) {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load your children");
      }
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!selectedChildId || !userRef.current) return;
    getAnalyticsSummary(userRef.current, selectedChildId, range)
      .then(setSummary)
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Couldn't load analytics"));
  }, [selectedChildId, range]);

  if (phase === "loading") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--kq-text-secondary)" }}>Loading…</p>
      </main>
    );
  }

  const selectedChild = children.find((c) => c.id === selectedChildId) ?? null;

  if (children.length > 1 && !selectedChild) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
        <Card style={{ maxWidth: 420, width: "100%", display: "flex", flexDirection: "column", gap: 16, height: "fit-content" }}>
          <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
            Whose activity?
          </h1>
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: "var(--kq-radius-control)", border: "2px solid var(--kq-border)", background: "var(--kq-white)", cursor: "pointer", textAlign: "left" }}
            >
              <Avatar color={child.mascotColor} label={child.nickname[0]?.toUpperCase() ?? "?"} size={48} />
              <span style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{child.nickname}</span>
            </button>
          ))}
        </Card>
      </main>
    );
  }

  const maxCategorySeconds = Math.max(1, ...(summary?.categoryBreakdown.map((c) => c.seconds) ?? [1]));

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
          {selectedChild ? `${selectedChild.nickname}'s activity` : "Activity"}
        </h1>

        <div style={{ display: "flex", gap: 8 }}>
          {RANGE_LABELS.map(({ range: r, label }) => (
            <Pill key={r} selected={range === r} onClick={() => setRange(r)}>
              {label}
            </Pill>
          ))}
        </div>

        {errorMessage && <p style={{ color: "var(--kq-terracotta)" }}>{errorMessage}</p>}

        {summary && (
          <>
            <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>Screen time</p>
              <p className="kq-heading" style={{ fontSize: "var(--kq-text-hero)", color: "var(--kq-charcoal)" }}>
                {formatDuration(summary.totalScreenTimeSeconds)}
              </p>
              <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
                across {summary.sessionCount} session{summary.sessionCount === 1 ? "" : "s"}
              </p>
            </Card>

            {summary.categoryBreakdown.length > 0 && (
              <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>What they watched</p>
                {summary.categoryBreakdown.map((c) => (
                  <div key={c.category}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 4 }}>
                      <span>{c.category}</span>
                      <span>{formatDuration(c.seconds)}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: "var(--kq-radius-pill)", background: "var(--kq-border)" }}>
                      <div style={{ height: "100%", width: `${Math.round((c.seconds / maxCategorySeconds) * 100)}%`, borderRadius: "var(--kq-radius-pill)", background: "var(--kq-teal)" }} />
                    </div>
                  </div>
                ))}
              </Card>
            )}

            <Card style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ fontSize: "var(--kq-text-body)", color: "var(--kq-charcoal)" }}>
                {summary.completionRatePercent}% of sessions ended on their own (wind-down); {summary.earlyExitRatePercent}% ended early.
              </p>
              <p style={{ fontSize: "var(--kq-text-body)", color: "var(--kq-charcoal)" }}>
                ≈{summary.contentSource.percentKidqReviewed}% of what they watched was KidQ-reviewed.
              </p>
            </Card>
          </>
        )}

        {!summary && phase === "ready" && <p style={{ color: "var(--kq-text-secondary)" }}>Loading activity…</p>}

        <button
          onClick={() => userRef.current && downloadCsvExport(userRef.current)}
          style={{ alignSelf: "flex-start", fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 8 }}
        >
          Admin: download CSV export
        </button>
      </div>
    </main>
  );
}
