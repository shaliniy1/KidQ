"use client";

import Link from "next/link";
import { simpleStatus, type AdminContent } from "@/lib/api";
import { labelFor, useTaxonomy } from "@/lib/useTaxonomy";

interface Props {
  items: AdminContent[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  searchQuery?: string;
  loading?: boolean;
}

export function ContentTable({ items, selected, onToggle, onToggleAll, searchQuery, loading = false }: Props) {
  const taxonomy = useTaxonomy();
  if (items.length === 0) return <p className="muted">Nothing matches these filters.</p>;
  const allSelected = items.every((item) => selected.has(item.id));
  const duration = (seconds: number | null) => {
    if (!seconds) return "—";
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  };
  const searchMatch = (item: AdminContent) => {
    const query = searchQuery?.trim().toLocaleLowerCase();
    if (!query) return null;
    const secondaryCategory = item.categories
      .filter((category) => category !== item.category)
      .map((category) => labelFor(taxonomy, "category", category))
      .find((category) => category.toLocaleLowerCase().includes(query));
    if (secondaryCategory) return `Matched category: ${secondaryCategory}`;
    const interest = item.interests.map((value) => labelFor(taxonomy, "interest", value)).find((value) => value.toLocaleLowerCase().includes(query));
    if (interest) return `Matched interest: ${interest}`;
    const visibleValues = [item.title, item.creator, item.kidq_summary, item.category && labelFor(taxonomy, "category", item.category), item.content_type]
      .filter(Boolean)
      .map((value) => String(value).toLocaleLowerCase());
    if (visibleValues.some((value) => value.includes(query))) return null;
    return "Matched in keywords or learning metadata";
  };
  return (
    <div className={`table-wrap content-table-wrap${loading ? " is-loading" : ""}`}>
      <label className="mobile-select-all">
        <input type="checkbox" checked={allSelected} onChange={(event) => onToggleAll(items.map((item) => item.id), event.target.checked)} />
        Select all {items.length} items on this page
      </label>
      <table className="content-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={(event) => onToggleAll(items.map((item) => item.id), event.target.checked)} />
            </th>
            <th>Content</th>
            <th className="category-col">Category</th>
            <th className="age-col">Age group</th>
            <th className="duration-col">Duration</th>
            <th>Status</th>
            <th><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="content-row">
              <td>
                <input type="checkbox" aria-label={`Select ${item.title}`} checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />
              </td>
              <td>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  {item.thumbnail_url ? <img className="thumb" src={item.thumbnail_url} alt={`${item.title} thumbnail`} /> : <div className="thumb" aria-hidden="true" />}
                  <div>
                    <Link href={`/content/${item.id}`} className="content-title">
                      {item.title}
                    </Link>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {item.creator ?? "Unknown creator"}
                      {item.parent_requests > 0 ? ` · ${item.parent_requests} parent request(s)` : ""}
                    </div>
                    <div className="compact-meta">
                      {item.category ? labelFor(taxonomy, "category", item.category) : "No category"} · {item.age.groups.length ? `Age ${item.age.groups.map((group) => group.replace("_", "–")).join(", ")}` : "Age not set"} · {duration(item.duration_seconds)}
                    </div>
                    {searchMatch(item) && <div className="search-match">{searchMatch(item)}</div>}
                  </div>
                </div>
              </td>
              <td className="category-col">{item.category ? labelFor(taxonomy, "category", item.category) : <span className="muted">Not set</span>}</td>
              <td className="age-col">{item.age.groups.length ? item.age.groups.map((group) => group.replace("_", "–")).join(", ") : <span className="muted">Not set</span>}</td>
              <td className="duration-col">{duration(item.duration_seconds)}</td>
              <td>
                {(() => { const status = simpleStatus(item); return <span className={`status status-${status.key}`}>{status.label}</span>; })()}
              </td>
              <td><Link href={`/content/${item.id}`} className="btn small content-action">Review</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
