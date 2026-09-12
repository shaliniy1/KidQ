"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, unwrap } from "@/lib/api";
import { useTaxonomy } from "@/lib/useTaxonomy";

type Run = Record<string, unknown> & { ingestion_run_id: string; status: string };
const AGE_GROUPS: Record<string, [number, number]> = { "0_2": [0, 2], "2_4": [2, 4], "4_6": [4, 6] };
const ACTIVE = new Set(["QUEUED", "RUNNING"]);

export default function AddContentPage() {
  const taxonomy = useTaxonomy();
  const [urls, setUrls] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("youtube");
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(10);
  const [current, setCurrent] = useState<Run | null>(null);
  const [recent, setRecent] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    const result = unwrap(await api.GET("/ingestion-runs"));
    setRecent(result.items as Run[]);
  }, []);

  useEffect(() => {
    void loadRecent().catch(() => undefined);
  }, [loadRecent]);

  // Poll the active run until the worker finishes it (this also keeps a sleeping QA API awake).
  useEffect(() => {
    if (!current || !ACTIVE.has(current.status)) return;
    const timer = setInterval(async () => {
      const run = unwrap(await api.GET("/ingestion-runs/{id}", { params: { path: { id: current.ingestion_run_id } } }));
      setCurrent(run as Run);
      if (!ACTIVE.has(run.status)) void loadRecent();
    }, 2000);
    return () => clearInterval(timer);
  }, [current, loadRecent]);

  const hints = () => {
    const value: Record<string, unknown> = {};
    if (ageGroup) [value.ageMin, value.ageMax] = AGE_GROUPS[ageGroup];
    if (category) value.category = category;
    return Object.keys(value).length ? value : undefined;
  };

  async function start(body: Record<string, unknown>) {
    setError(null);
    try {
      const run = unwrap(await api.POST("/ingestion-runs", { body: body as never }));
      setCurrent(run as Run);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not start the import.");
    }
  }

  function submitUrls(event: FormEvent) {
    event.preventDefault();
    const list = urls.split(/\s+/).map((url) => url.trim()).filter(Boolean);
    if (list.length) void start({ mode: "urls", source: "youtube", urls: list, hints: hints() });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length >= 2) void start({ mode: "search", source, queries: [{ query: query.trim(), maxResults, hints: hints() }] });
  }

  return (
    <div className="stack">
      <h1>Add content</h1>
      <p className="muted">
        New items are saved, checked by the rules and scored by the AI automatically. They only reach families after you publish them.
      </p>

      <div className="two-col">
        <form className="card stack" onSubmit={submitUrls}>
          <h2>Paste YouTube links</h2>
          <textarea aria-label="YouTube links, one per line" placeholder="https://www.youtube.com/watch?v=…" value={urls} onChange={(event) => setUrls(event.target.value)} rows={8} />
          <button className="btn primary" disabled={!urls.trim()}>
            Import links
          </button>
        </form>
        <form className="card stack" onSubmit={submitSearch}>
          <h2>Run discovery</h2>
          <label>
            Source
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="youtube">YouTube (official API, strict safe search)</option>
              <option value="nasa_images">NASA Image and Video Library</option>
              <option value="wikimedia_commons">Wikimedia Commons</option>
            </select>
          </label>
          <label>
            Search for
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="calm counting for toddlers" />
          </label>
          <label>
            How many
            <input type="number" min={1} max={50} value={maxResults} onChange={(event) => setMaxResults(Number(event.target.value))} />
          </label>
          <button className="btn primary" disabled={query.trim().length < 2}>
            Run discovery
          </button>
        </form>
      </div>

      <div className="card row">
        <span className="muted">Optional hints for both (the AI and you can change them later):</span>
        <select aria-label="Age group hint" value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)}>
          <option value="">Age group…</option>
          {taxonomy?.age_group.map((term) => (
            <option key={term.key} value={term.key}>
              {term.label}
            </option>
          ))}
        </select>
        <select aria-label="Category hint" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Category…</option>
          {taxonomy?.category.map((term) => (
            <option key={term.key} value={term.key}>
              {term.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {current && (
        <div className="card">
          <h2>Import {ACTIVE.has(current.status) ? "running…" : current.status.toLowerCase()}</h2>
          <p>
            Seen {String(current.records_seen)} · added {String(current.records_created)} · updated {String(current.records_updated)} · unchanged{" "}
            {String(current.records_unchanged)} · skipped {String(current.records_rejected_before_ai)}
          </p>
          {Array.isArray(current.errors) && current.errors.length > 0 && (
            <ul className="muted">
              {(current.errors as Array<{ code: string; message: string; external_id: string | null }>).slice(0, 20).map((item, index) => (
                <li key={index}>
                  {item.external_id ?? "—"}: {item.code} — {item.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <h2>Recent imports</h2>
        {recent.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Skipped</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((run) => (
                  <tr key={run.ingestion_run_id}>
                    <td>{new Date(String(run.started_at)).toLocaleString()}</td>
                    <td>{String(run.source_system_id)}</td>
                    <td>
                      <span className="badge">{run.status}</span>
                    </td>
                    <td>{String(run.records_created)}</td>
                    <td>{String(run.records_rejected_before_ai)}</td>
                    <td className="muted">{String(run.requested_by ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
