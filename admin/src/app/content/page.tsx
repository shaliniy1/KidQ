"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BulkBar } from "@/components/BulkBar";
import { ContentTable } from "@/components/ContentTable";
import { api, friendlyError, unwrap, type AdminContent } from "@/lib/api";
import { useTaxonomy } from "@/lib/useTaxonomy";

const PAGE_SIZE = 50;
const FILTER_KEYS = ["state", "age_group", "category", "source", "flagged", "q", "sort"] as const;

function Library() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const taxonomy = useTaxonomy();
  const [items, setItems] = useState<AdminContent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(params.get("q") ?? "");

  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? undefined]).filter(([, value]) => value)) as Record<string, string>;
  const filterKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    setError(null);
    try {
      const query = { ...JSON.parse(filterKey), limit: PAGE_SIZE, offset };
      const page = unwrap(await api.GET("/content-items", { params: { query } }));
      setItems(page.items);
      setTotal(page.total);
    } catch (failure) {
      setError(friendlyError(failure, "Content could not be loaded. Please try again."));
    }
  }, [filterKey, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setOffset(0);
    setSelected(new Set());
    router.replace(`${pathname}?${next.toString()}`);
  };

  // Search as you type (after a short pause), not only on Enter.
  useEffect(() => {
    if (search.trim() === (params.get("q") ?? "")) return;
    const timer = setTimeout(() => setFilter("q", search.trim()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = (ids: string[], checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });

  return (
    <div className="stack library-page">
      <div className="page-heading">
        <div>
          <h1>Content</h1>
          <p className="muted">Find, review and publish KidQ content.</p>
        </div>
        <Link className="btn primary" href="/add">Add content</Link>
      </div>

      <form className="content-search"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter("q", search.trim());
          }}
        >
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search content" placeholder="Search by title, category, keyword or age…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {search && <button type="button" className="clear-search" aria-label="Clear search" onClick={() => setSearch("")}>×</button>}
      </form>

      <div className="category-tabs" aria-label="Filter by category">
        <button type="button" className={!filters.category ? "active" : undefined} onClick={() => setFilter("category", "")}>All content</button>
        {taxonomy?.category.map((term) => (
          <button key={term.key} type="button" className={filters.category === term.key ? "active" : undefined} onClick={() => setFilter("category", term.key)}>
            {term.label}
          </button>
        ))}
      </div>

      <div className="library-controls">
        <select aria-label="Status" value={filters.state ?? ""} onChange={(event) => setFilter("state", event.target.value)}>
          <option value="">All statuses</option>
          <option value="PENDING_ANALYSIS">Pending review</option>
          <option value="ANALYSIS_INCOMPLETE">Review in progress</option>
          <option value="READY_TO_APPROVE">Needs confirmation</option>
          <option value="NEEDS_ATTENTION">Needs changes</option>
          <option value="APPROVED">Published</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select aria-label="Age group" value={filters.age_group ?? ""} onChange={(event) => setFilter("age_group", event.target.value)}>
          <option value="">All ages</option>
          {taxonomy?.age_group.map((term) => (
            <option key={term.key} value={term.key}>
              {term.label}
            </option>
          ))}
        </select>
        <select aria-label="Sort" value={filters.sort ?? "newest"} onChange={(event) => setFilter("sort", event.target.value)}>
          <option value="newest">Newest</option>
          <option value="score">Highest score</option>
          <option value="title">Title</option>
        </select>
        <details className="more-filters">
          <summary>More filters</summary>
          <div className="more-filter-menu">
            <select aria-label="Source" value={filters.source ?? ""} onChange={(event) => setFilter("source", event.target.value)}>
              <option value="">All sources</option>
              <option value="youtube">YouTube</option>
              <option value="nasa_images">NASA</option>
              <option value="wikimedia_commons">Wikimedia Commons</option>
              <option value="storyweaver">StoryWeaver</option>
            </select>
            <label className="row" style={{ fontWeight: 500 }}>
              <input type="checkbox" checked={filters.flagged === "true"} onChange={(event) => setFilter("flagged", event.target.checked ? "true" : "")} />
              Needs a safety check
            </label>
          </div>
        </details>
        <span className="result-count">{total} {total === 1 ? "item" : "items"}</span>
      </div>

      <BulkBar
        selectedIds={[...selected]}
        onDone={() => {
          setSelected(new Set());
          void load();
        }}
      />
      {error && <div className="notice-error">{error}<button className="link-button" onClick={() => void load()}>Try again</button></div>}
      <ContentTable items={items} selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
      <div className="pagination">
        <button className="btn small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
          ← Previous
        </button>
        <span className="muted">
          {total === 0 ? "0" : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)}`} of {total}
        </span>
        <button className="btn small" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
          Next →
        </button>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Library />
    </Suspense>
  );
}
