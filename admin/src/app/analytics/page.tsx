"use client";

// Admin Analytics: how families are using KidQ, platform-wide — the same sections as the parent
// Analytics page (docs/api/README.md "Analytics"), read from GET /analytics. Never per-child raw
// events; admins see the same rollups parents do, at platform scale.
import { useCallback, useEffect, useState } from "react";
import { api, friendlyError, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api-types";

type Period = "today" | "7d" | "30d";
type Analytics = paths["/analytics"]["get"]["responses"][200]["content"]["application/json"];

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];
const PART_LABELS: Record<string, string> = { MORNING: "Morning", AFTERNOON: "Afternoon", EVENING: "Evening", OTHER: "Other times" };

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (value: Period) => {
    try {
      setError(null);
      setData(unwrap(await api.GET("/analytics", { params: { query: { period: value } } })));
    } catch (failure) {
      setError(friendlyError(failure, "Analytics could not be loaded. Please try again."));
    }
  }, []);

  useEffect(() => {
    void load(period);
    const interval = setInterval(() => void load(period), 20_000);
    return () => clearInterval(interval);
  }, [load, period]);

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Analytics</h1>
          <p className="muted">How families are using KidQ, across every child.</p>
        </div>
      </div>

      <div className="category-tabs" role="tablist" aria-label="Time period">
        {PERIODS.map((option) => (
          <button key={option.key} type="button" className={option.key === period ? "active" : undefined} onClick={() => setPeriod(option.key)}>
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="notice-error">
          {error}
          <button className="link-button" onClick={() => void load(period)}>
            Try again
          </button>
        </div>
      )}

      {!data ? (
        !error && <p className="muted">Loading analytics…</p>
      ) : !data.has_data ? (
        <div className="card">
          <p className="muted">Nothing was watched in this period yet.</p>
        </div>
      ) : (
        <AnalyticsSections data={data} />
      )}
    </div>
  );
}

function AnalyticsSections({ data }: { data: Analytics }) {
  const maxDaily = Math.max(1, ...data.daily.map((day) => day.minutes));
  return (
    <>
      <section className="analytics-overview" aria-label="Overview">
        <div className="card analytics-stat">
          <span className="muted">Screen time</span>
          <strong className="stat">{formatMinutes(data.overview.screen_minutes)}</strong>
        </div>
        <div className="card analytics-stat">
          <span className="muted">Videos watched</span>
          <strong className="stat">{data.overview.videos_watched}</strong>
        </div>
        <div className="card analytics-stat">
          <span className="muted">Activities completed</span>
          <strong className="stat">{data.overview.activities_completed}</strong>
        </div>
        <div className="card analytics-stat">
          <span className="muted">Active children</span>
          <strong className="stat">
            {data.children_active} / {data.children_total}
          </strong>
        </div>
      </section>
      {data.overview.vs_previous && (
        <p className="muted">
          {data.overview.vs_previous.minutes_diff === 0
            ? `About the same screen time as ${data.overview.vs_previous.compared_with}.`
            : `${Math.abs(data.overview.vs_previous.minutes_diff)} minutes ${data.overview.vs_previous.minutes_diff < 0 ? "less" : "more"} than ${data.overview.vs_previous.compared_with}.`}
        </p>
      )}

      <div className="two-col">
        <div className="card">
          <h2>Screen time by day</h2>
          <div className="analytics-bars">
            {data.daily.map((day) => (
              <div key={day.date} className="analytics-bar-col" title={`${day.date}: ${formatMinutes(day.minutes)}`}>
                <div className="bar analytics-bar-track">
                  <i style={{ height: `${Math.round((day.minutes / maxDaily) * 100)}%` }} />
                </div>
                <span className="analytics-bar-label">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>What they&rsquo;re watching</h2>
          <div className="stack">
            {data.categories.map((category) => (
              <div key={category.key} className="analytics-row">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span>{category.label}</span>
                  <span className="muted">
                    {category.percent}% · {formatMinutes(category.minutes)}
                  </span>
                </div>
                <div className="bar">
                  <i style={{ width: `${category.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h2>Most engaged categories</h2>
          {data.engaged.length === 0 ? (
            <p className="muted">Not enough repeat viewing yet to call out a category.</p>
          ) : (
            <div className="stack">
              {data.engaged.map((category) => (
                <div key={category.key} className="row" style={{ justifyContent: "space-between" }}>
                  <span>{category.label}</span>
                  <span className="muted">
                    {formatMinutes(category.minutes)} · {category.videos + category.activities} items · {category.average_completion}% average completion
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Finishing what they start</h2>
          <div className="chips">
            <span className="chip">{data.completion.started} started</span>
            <span className="chip">{data.completion.completed} completed</span>
            <span className="chip">{data.completion.partly_watched} partly watched</span>
            <span className="chip">{data.completion.stopped_early} stopped early</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Most watched content</h2>
        <div className="stack">
          {data.top_content.length === 0 ? (
            <p className="muted">Nothing watched enough yet to rank.</p>
          ) : (
            data.top_content.map((entry) => (
              <div key={entry.card.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>{entry.card.title}</span>
                <span className="muted">
                  {formatMinutes(entry.minutes)} · watched {entry.times_watched}× · {entry.completion}% completion
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h2>When they watch</h2>
          <div className="stack">
            {data.pattern.map((part) => (
              <div key={part.part} className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  {PART_LABELS[part.part] ?? part.label} <span className="muted">({part.hours})</span>
                </span>
                <strong>{formatMinutes(part.minutes)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Videos vs activities</h2>
          <div className="bar" style={{ height: 14 }}>
            <i style={{ width: `${data.split.video_percent}%` }} />
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {data.split.video_percent}% videos ({formatMinutes(data.split.video_minutes)}) · {data.split.activity_percent}% activities ({formatMinutes(data.split.activity_minutes)})
          </p>
        </div>
      </div>

      {data.insights.length > 0 && (
        <div className="card">
          <h2>Notes</h2>
          <ul className="stack" style={{ margin: 0, paddingLeft: 18 }}>
            {data.insights.map((insight) => (
              <li key={insight}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
