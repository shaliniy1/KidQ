"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BulkBar } from "@/components/BulkBar";
import { ContentTable } from "@/components/ContentTable";
import { STATE_LABELS, api, unwrap, type AdminContent } from "@/lib/api";
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
      setError(failure instanceof Error ? failure.message : "Could not load content.");
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
    <div>
      <h1>Content library</h1>
      <div className="toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setFilter("q", search.trim());
          }}
        >
          <input aria-label="Search titles" placeholder="Search titles…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </form>
        <select aria-label="State" value={filters.state ?? ""} onChange={(event) => setFilter("state", event.target.value)}>
          <option value="">All states</option>
          {Object.entries(STATE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select aria-label="Age group" value={filters.age_group ?? ""} onChange={(event) => setFilter("age_group", event.target.value)}>
          <option value="">All ages</option>
          {taxonomy?.age_group.map((term) => (
            <option key={term.key} value={term.key}>
              {term.label}
            </option>
          ))}
        </select>
        <select aria-label="Category" value={filters.category ?? ""} onChange={(event) => setFilter("category", event.target.value)}>
          <option value="">All categories</option>
          {taxonomy?.category.map((term) => (
            <option key={term.key} value={term.key}>
              {term.label}
            </option>
          ))}
        </select>
        <select aria-label="Source" value={filters.source ?? ""} onChange={(event) => setFilter("source", event.target.value)}>
          <option value="">All sources</option>
          <option value="youtube">YouTube</option>
          <option value="nasa_images">NASA</option>
          <option value="wikimedia_commons">Wikimedia Commons</option>
        </select>
        <select aria-label="Sort" value={filters.sort ?? "newest"} onChange={(event) => setFilter("sort", event.target.value)}>
          <option value="newest">Newest</option>
          <option value="score">Highest score</option>
          <option value="title">Title</option>
        </select>
        <label className="row" style={{ fontWeight: 500 }}>
          <input type="checkbox" checked={filters.flagged === "true"} onChange={(event) => setFilter("flagged", event.target.checked ? "true" : "")} />
          Safety flags only
        </label>
      </div>

      <BulkBar
        selectedIds={[...selected]}
        onDone={() => {
          setSelected(new Set());
          void load();
        }}
      />
      {error && <p className="error">{error}</p>}
      <ContentTable items={items} selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
      <div className="toolbar" style={{ marginTop: 14 }}>
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
