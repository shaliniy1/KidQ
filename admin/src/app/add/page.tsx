"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, friendlyError, simpleStatus, unwrap, type AdminContent, type Dashboard } from "@/lib/api";
import { ageRange, useTaxonomy } from "@/lib/useTaxonomy";

type Run = Record<string, unknown> & { ingestion_run_id: string; status: string };
const ACTIVE = new Set(["QUEUED", "RUNNING"]);
const SOURCE_LABELS: Record<string, string> = {
  youtube: "YouTube",
  storyweaver: "StoryWeaver",
  nasa_images: "NASA",
  wikimedia_commons: "Wikimedia",
};

export default function AddContentPage() {
  const taxonomy = useTaxonomy();
  const [method, setMethod] = useState<"links" | "pdf" | "discover">("links");
  const [urls, setUrls] = useState("");
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [ageGroup, setAgeGroup] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("youtube");
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(10);
  const [current, setCurrent] = useState<Run | null>(null);
  const [recent, setRecent] = useState<Run[]>([]);
  const [summary, setSummary] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    const result = unwrap(await api.GET("/ingestion-runs"));
    setRecent(result.items as Run[]);
  }, []);

  const loadSummary = useCallback(async () => {
    setSummary(unwrap(await api.GET("/dashboard")));
  }, []);

  useEffect(() => {
    void loadRecent().catch(() => undefined);
    void loadSummary().catch(() => undefined);
  }, [loadRecent, loadSummary]);

  // Poll the active run until the worker finishes it (this also keeps a sleeping QA API awake), then a
  // few more times to catch AI scoring finishing just after, so the score shown below isn't stuck on
  // "Scoring…" from a page the admin never revisits.
  const scorePollsLeft = useRef(0);
  useEffect(() => {
    if (!current) return;
    if (ACTIVE.has(current.status)) scorePollsLeft.current = 5;
    else if (scorePollsLeft.current <= 0) return;
    const timer = setInterval(async () => {
      const run = unwrap(await api.GET("/ingestion-runs/{id}", { params: { path: { id: current.ingestion_run_id } } }));
      setCurrent(run as Run);
      if (ACTIVE.has(run.status)) return;
      void loadRecent();
      void loadSummary();
      scorePollsLeft.current -= 1;
    }, 2000);
    return () => clearInterval(timer);
  }, [current, loadRecent, loadSummary]);

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

  const classificationFields = () => (
    <div className="classification-fields">
      <label>
        Age group
        <select aria-label="Age group" value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)}>
          <option value="">Choose an age breakpoint…</option>
          {taxonomy?.age_group.map((term) => <option key={term.key} value={term.key}>{term.label}</option>)}
        </select>
      </label>
      <label>
        Category
        <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Choose a category…</option>
          {taxonomy?.category.map((term) => <option key={term.key} value={term.key}>{term.label}</option>)}
        </select>
      </label>
    </div>
  );

  return (
    <div className="stack">
      <div className="page-heading"><div><h1>Add content</h1><p className="muted">New content is saved as a draft for you to review before publishing.</p></div></div>

      {summary && (
        <section className="fetched-summary" aria-label="Fetched content summary">
          <div className="fetched-total">
            <span>Content fetched</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="source-totals">
            {Object.entries(SOURCE_LABELS).map(([source, label]) => (
              <span key={source}><strong>{summary.by_source[source] ?? 0}</strong> {label}</span>
            ))}
          </div>
          <Link href="/content">View all content →</Link>
        </section>
      )}

      <div className="add-workspace">
        <div className="method-tabs" role="tablist" aria-label="Choose how to add content">
          <button type="button" role="tab" aria-selected={method === "links"} className={method === "links" ? "active" : undefined} onClick={() => setMethod("links")}>Video links</button>
          <button type="button" role="tab" aria-selected={method === "pdf"} className={method === "pdf" ? "active" : undefined} onClick={() => setMethod("pdf")}>Upload PDF</button>
          <button type="button" role="tab" aria-selected={method === "discover"} className={method === "discover" ? "active" : undefined} onClick={() => setMethod("discover")}>Discover</button>
        </div>

        {method === "links" && <form className="add-panel stack" onSubmit={submitUrls}>
          <div className="add-panel-heading"><span className="method-icon">↗</span><div><h2>Add video links</h2><p className="muted">Paste one or more YouTube URLs. Each link will be added as a draft.</p></div></div>
          <textarea aria-label="YouTube links, one per line" placeholder={'https://www.youtube.com/watch?v=…\nhttps://youtu.be/…'} value={urls} onChange={(event) => setUrls(event.target.value)} rows={6} />
          {parsedUrls.length > 0 && <div className="import-preview"><strong>{parsedUrls.length} {parsedUrls.length === 1 ? "link" : "links"} ready</strong>{parsedUrls.slice(0, 4).map((url) => <span key={url}>{url}</span>)}</div>}
          {classificationFields()}
          <button className="btn primary add-submit" disabled={!urls.trim()}>
            Add {parsedUrls.length || ""} {parsedUrls.length === 1 ? "item" : "items"}
          </button>
        </form>}

        {method === "pdf" && <section className="add-panel stack">
          <div className="add-panel-heading"><span className="method-icon">PDF</span><div><h2>Upload PDFs</h2><p className="muted">Choose picture books or learning documents to add.</p></div></div>
          <label className="file-drop">
            <input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => setPdfs(Array.from(event.target.files ?? []))} />
            <strong>{pdfs.length ? `${pdfs.length} PDF ${pdfs.length === 1 ? "selected" : "files selected"}` : "Choose PDF files"}</strong>
            <span>{pdfs.length ? pdfs.map((file) => file.name).join(", ") : "PDF files up to 20 MB each"}</span>
          </label>
          <label className="cover-picker">
            Cover image
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCover(event.target.files?.[0] ?? null)} />
            <span>{cover ? cover.name : "Choose a JPG, PNG or WebP cover"}</span>
          </label>
          {classificationFields()}
          <button className="btn primary add-submit" disabled title="Connect file storage to enable PDF uploads">Add {pdfs.length || ""} {pdfs.length === 1 ? "PDF" : "PDFs"}</button>
          <p className="muted storage-note">PDF saving will be enabled after KidQ file storage is connected.</p>
        </section>}

        {method === "discover" && <form className="add-panel stack" onSubmit={submitSearch}>
          <div className="add-panel-heading"><span className="method-icon">⌕</span><div><h2>Discover open content</h2><p className="muted">Search a trusted source, then review the results in Content.</p></div></div>
          <div className="discover-fields">
            <label>Source<select value={source} onChange={(event) => setSource(event.target.value)}><option value="youtube">YouTube</option><option value="nasa_images">NASA</option><option value="wikimedia_commons">Wikimedia Commons</option><option value="storyweaver">StoryWeaver picture books</option></select></label>
            <label className="discover-query">Search for<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="calm counting for toddlers" /></label>
            <label>Number of results<input type="number" min={1} max={50} value={maxResults} onChange={(event) => setMaxResults(Number(event.target.value))} /></label>
          </div>
          {classificationFields()}
          <button className="btn primary add-submit" disabled={query.trim().length < 2}>
            Find content
          </button>
        </form>}
      </div>

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
          {Array.isArray(current.created_items) && current.created_items.length > 0 && (
            <ul className="added-items stack" aria-label="Items just added, with their KidQ score">
              {(current.created_items as AdminContent[]).map((item) => {
                const status = simpleStatus(item);
                const score = item.content_score;
                return (
                  <li key={item.id} className="added-item row">
                    {item.thumbnail_url ? <img className="thumb" src={item.thumbnail_url} alt="" /> : <div className="thumb" aria-hidden="true" />}
                    <div>
                      <Link href={`/content/${item.id}`} className="content-title">{item.title}</Link>
                      <div className="muted" style={{ fontSize: 13 }}>
                        <span className={`status status-${status.key}`}>{status.label}</span>
                        {" · "}
                        {score?.score != null ? `KidQ score ${Math.round(score.score)}` : status.key === "draft" || status.key === "review" ? "Scoring…" : "Not yet scored"}
                      </div>
                    </div>
                  </li>
                );
              })}
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
