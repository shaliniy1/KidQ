"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, friendlyError, unwrap, type Dashboard } from "@/lib/api";

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(unwrap(await api.GET("/dashboard")));
      setError(null);
    } catch (failure) {
      setError(friendlyError(failure, "The overview could not be loaded. Please try again."));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!data) {
    return error ? <div className="notice-error">{error}<button className="link-button" onClick={() => void load()}>Try again</button></div> : <p className="muted">Loading content…</p>;
  }

  const summaries = [
    { label: "Pending review", count: data.by_state.PENDING_ANALYSIS ?? 0, href: "/content?state=PENDING_ANALYSIS", tone: "draft" },
    { label: "Review in progress", count: (data.by_state.ANALYSING ?? 0) + (data.by_state.ANALYSIS_INCOMPLETE ?? 0), href: "/review", tone: "review" },
    { label: "Needs changes", count: (data.by_state.NEEDS_ATTENTION ?? 0) + (data.by_state.FAILED ?? 0) + (data.by_state.REJECTED ?? 0), href: "/content?state=NEEDS_ATTENTION", tone: "changes" },
    { label: "Needs confirmation", count: data.by_state.READY_TO_APPROVE ?? 0, href: "/content?state=READY_TO_APPROVE", tone: "confirm" },
    { label: "Published", count: data.by_state.APPROVED ?? 0, href: "/content?state=APPROVED", tone: "published" },
  ];

  return (
    <div className="stack overview-page">
      <div className="page-heading">
        <div>
          <h1>Content overview</h1>
          <p className="muted">Review what needs attention or find content in the library.</p>
        </div>
        <Link className="btn primary" href="/add">Add content</Link>
      </div>

      <section className="summary-strip" aria-label="Content status summary">
        {summaries.map((item) => (
          <Link key={item.label} href={item.href} className={`summary-item summary-${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </Link>
        ))}
      </section>

      <section className="next-action">
        <div>
          <p className="eyebrow">Next step</p>
          <h2>Content is waiting for your review</h2>
          <p className="muted">Open the review list, confirm the category and age group, then publish or request changes.</p>
        </div>
        <Link href="/review" className="btn good">Open review list</Link>
      </section>

      <div className="simple-links">
        <Link href="/content" className="simple-link browse-link"><strong>Browse all content <span aria-hidden="true">→</span></strong><small>Search and filter {data.total} items</small></Link>
        <Link href="/add" className="simple-link add-link"><strong>Add new content <span aria-hidden="true">＋</span></strong><small>Import links or discover open content</small></Link>
      </div>
    </div>
  );
}
