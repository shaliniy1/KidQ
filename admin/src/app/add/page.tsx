"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, friendlyError, unwrap } from "@/lib/api";
import { ageRange, useTaxonomy } from "@/lib/useTaxonomy";

type Run = Record<string, unknown> & { ingestion_run_id: string; status: string };
const ACTIVE = new Set(["QUEUED", "RUNNING"]);

export default function AddContentPage() {
  const taxonomy = useTaxonomy();
  const [urls, setUrls] = useState("");
  const [pdfs, setPdfs] = useState<File[]>([]);
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
    const range = ageRange(taxonomy, ageGroup);
    if (range) [value.ageMin, value.ageMax] = range;
    if (category) value.category = category;
    return Object.keys(value).length ? value : undefined;
  };

  async function start(body: Record<string, unknown>) {
    setError(null);
    try {
      const run = unwrap(await api.POST("/ingestion-runs", { body: body as never }));
      setCurrent(run as Run);
    } catch (failure) {
      setError(friendlyError(failure, "Content could not be added. Check the details and try again."));
    }
  }

  function submitUrls(event: FormEvent) {
    event.preventDefault();
    const list = urls.split(/\s+/).map((url) => url.trim()).filter(Boolean);
    if (list.length) void start({ mode: "urls", source: "youtube", urls: list, hints: hints() });
  }

  const parsedUrls = urls.split(/\s+/).map((url) => url.trim()).filter(Boolean);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length >= 2) void start({ mode: "search", source, queries: [{ query: query.trim(), maxResults, hints: hints() }] });
  }

  return (
    <div className="stack">
      <div className="page-heading"><div><h1>Add content</h1><p className="muted">New content is saved as a draft for you to review before publishing.</p></div></div>

      <div className="add-grid">
        <form className="card stack" onSubmit={submitUrls}>
          <div><span className="method-number">1</span><h2>Add video links</h2><p className="muted">Paste one YouTube URL per line.</p></div>
          <textarea aria-label="YouTube links, one per line" placeholder={'https://www.youtube.com/watch?v=…\nhttps://youtu.be/…'} value={urls} onChange={(event) => setUrls(event.target.value)} rows={6} />
          {parsedUrls.length > 0 && <div className="import-preview"><strong>{parsedUrls.length} {parsedUrls.length === 1 ? "link" : "links"} ready</strong>{parsedUrls.slice(0, 4).map((url) => <span key={url}>{url}</span>)}</div>}
          <button className="btn primary" disabled={!urls.trim()}>
            Add {parsedUrls.length || ""} {parsedUrls.length === 1 ? "item" : "items"}
          </button>
        </form>

        <section className="card stack">
          <div><span className="method-number">2</span><h2>Upload PDFs</h2><p className="muted">Add picture books or learning documents.</p></div>
          <label className="file-drop">
            <input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => setPdfs(Array.from(event.target.files ?? []))} />
            <strong>{pdfs.length ? `${pdfs.length} PDF ${pdfs.length === 1 ? "selected" : "files selected"}` : "Choose PDF files"}</strong>
            <span>{pdfs.length ? pdfs.map((file) => file.name).join(", ") : "PDF files up to 20 MB each"}</span>
          </label>
          <button className="btn primary" disabled title="Connect file storage to enable PDF uploads">Add {pdfs.length || ""} {pdfs.length === 1 ? "PDF" : "PDFs"}</button>
          <p className="muted storage-note">PDF saving will be enabled after KidQ file storage is connected.</p>
        </section>

        <form className="card stack" onSubmit={submitSearch}>
          <div><span className="method-number">3</span><h2>Find open content</h2><p className="muted">Search approved open sources.</p></div>
          <label>
            Source
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="youtube">YouTube</option>
              <option value="nasa_images">NASA</option>
              <option value="wikimedia_commons">Wikimedia Commons</option>
              <option value="storyweaver">StoryWeaver picture books</option>
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
            Find content
          </button>
        </form>
      </div>

      <details className="advanced-review">
        <summary>Set a category and age group</summary>
        <div className="row" style={{ marginTop: 12 }}>
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
      </details>

      {error && <div className="notice-error">{error}</div>}
      {current && (
        <div className="card">
          <h2>{ACTIVE.has(current.status) ? "Adding content…" : current.status === "SUCCEEDED" ? "Content added" : "Import finished"}</h2>
          <p>{String(current.records_created)} new {Number(current.records_created) === 1 ? "item" : "items"} added. {String(current.records_rejected_before_ai)} skipped.</p>
          {Array.isArray(current.errors) && current.errors.length > 0 && (
            <ul className="muted">
              {(current.errors as Array<{ message: string }>).slice(0, 5).map((item, index) => <li key={index}>{item.message}</li>)}
            </ul>
          )}
        </div>
      )}

      <details className="advanced-review">
        <summary>Recent activity</summary>
        {recent.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Source</th>
                  <th>Result</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((run) => (
                  <tr key={run.ingestion_run_id}>
                    <td>{new Date(String(run.started_at)).toLocaleString()}</td>
                    <td>{String(run.source_system_id)}</td>
                    <td>
                      <span className="badge">{ACTIVE.has(run.status) ? "In progress" : run.status === "SUCCEEDED" ? "Complete" : "Finished with some issues"}</span>
                    </td>
                    <td>{String(run.records_created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
