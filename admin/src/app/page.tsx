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

  const tile = (label: string, state: string, tone: string) => ({ label, count: data.by_state[state] ?? 0, href: `/content?state=${state}`, tone });
  const summaries = [
    tile("Draft", "PENDING_ANALYSIS", "draft"),
    tile("Ready to publish", "READY_TO_APPROVE", "review"),
    tile("Needs changes", "NEEDS_ATTENTION", "changes"),
    tile("Published", "APPROVED", "published"),
    tile("Rejected", "REJECTED", "changes"),
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
          <h2>Review content waiting for you</h2>
          <p className="muted">Check the content, confirm its category and age group, then publish or request changes.</p>
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
