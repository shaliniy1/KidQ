"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STATE_LABELS, api, unwrap } from "@/lib/api";

interface Dashboard {
  total: number;
  by_state: Record<string, number>;
  by_source: Record<string, number>;
  flagged: number;
  queue: Array<{ event_type: string; status: string; n: number }>;
  ai_today: { youtube_video_seconds: number; daily_cap_seconds: number; requests: number; enabled: boolean };
}

const STATE_ORDER = ["READY_TO_APPROVE", "NEEDS_ATTENTION", "ANALYSIS_INCOMPLETE", "PENDING_ANALYSIS", "ANALYSING", "FAILED", "APPROVED", "REJECTED"];

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .GET("/dashboard")
      .then((result) => setData(unwrap(result) as unknown as Dashboard))
      .catch((failure: Error) => setError(failure.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const minutesUsed = Math.round(data.ai_today.youtube_video_seconds / 60);
  const minutesCap = Math.round(data.ai_today.daily_cap_seconds / 60);
  return (
    <div className="stack">
      <h1>Dashboard</h1>
      <section className="grid">
        <div className="card">
          <div className="muted">All content</div>
          <div className="stat">{data.total}</div>
        </div>
        {STATE_ORDER.map((state) => (
          <Link key={state} href={`/content?state=${state}`} className="card" style={{ textDecoration: "none" }}>
            <div className="muted">{STATE_LABELS[state]}</div>
            <div className="stat">{data.by_state[state] ?? 0}</div>
          </Link>
        ))}
        <Link href="/content?flagged=true" className="card" style={{ textDecoration: "none" }}>
          <div className="muted">Safety flags</div>
          <div className="stat">{data.flagged}</div>
        </Link>
      </section>

      <section className="two-col">
        <div className="card">
          <h2>AI scoring today</h2>
          {data.ai_today.enabled ? (
            <>
              <p>
                {minutesUsed} of {minutesCap} free-tier minutes of YouTube video used ({data.ai_today.requests} requests).
              </p>
              <div className="bar">
                <i style={{ width: `${Math.min(100, (minutesUsed / Math.max(1, minutesCap)) * 100)}%` }} />
              </div>
              <p className="muted">Scoring resumes automatically after midnight Pacific when the limit is reached.</p>
            </>
          ) : (
            <p className="muted">GEMINI_API_KEY isn&apos;t set on the API, so items wait for manual scoring.</p>
          )}
        </div>
        <div className="card">
          <h2>By source</h2>
          {Object.keys(data.by_source).length === 0 ? (
            <p className="muted">
              No content yet. <Link href="/add">Add content</Link>
            </p>
          ) : (
            <ul>
              {Object.entries(data.by_source).map(([source, count]) => (
                <li key={source}>
                  {source}: {count}
                </li>
              ))}
            </ul>
          )}
          <h3>Job queue</h3>
          {data.queue.length === 0 ? (
            <p className="muted">Nothing waiting.</p>
          ) : (
            <ul>
              {data.queue.map((job) => (
                <li key={`${job.event_type}-${job.status}`}>
                  {job.event_type} · {job.status.toLowerCase()}: {job.n}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
