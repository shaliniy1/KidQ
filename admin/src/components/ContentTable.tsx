"use client";

import Link from "next/link";
import { BLOCKER_LABELS, STATE_LABELS, type AdminContent } from "@/lib/api";

interface Props {
  items: AdminContent[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
}

export function ContentTable({ items, selected, onToggle, onToggleAll }: Props) {
  if (items.length === 0) return <p className="muted">Nothing here.</p>;
  const allSelected = items.every((item) => selected.has(item.id));
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              <input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={(event) => onToggleAll(items.map((item) => item.id), event.target.checked)} />
            </th>
            <th>Video</th>
            <th>State</th>
            <th>Score</th>
            <th>Age</th>
            <th>Category</th>
            <th>Still needed</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <input type="checkbox" aria-label={`Select ${item.title}`} checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />
              </td>
              <td>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  {item.thumbnail_url ? <img className="thumb" src={item.thumbnail_url} alt="" /> : <div className="thumb" />}
                  <div>
                    <Link href={`/content/${item.id}`}>
                      <strong>{item.title}</strong>
                    </Link>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {item.creator ?? "Unknown creator"} · {item.source}
                      {item.parent_requests > 0 ? ` · ${item.parent_requests} parent request(s)` : ""}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <span className={`badge ${item.studio_state}`}>{STATE_LABELS[item.studio_state] ?? item.studio_state}</span>
              </td>
              <td>
                {item.content_score?.score != null ? <span className="score" style={{ fontSize: 18 }}>{item.content_score.score}</span> : <span className="muted">—</span>}
                {item.content_score && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    {Math.round(item.content_score.confidence * 100)}% confidence
                  </div>
                )}
              </td>
              <td>{item.age.groups.length ? item.age.groups.map((group) => group.replace("_", "–")).join(", ") : <span className="muted">—</span>}</td>
              <td>{item.category ?? <span className="muted">—</span>}</td>
              <td>
                <div className="chips">
                  {item.publish_blockers.map((blocker) => (
                    <span key={blocker} className="chip">
                      {BLOCKER_LABELS[blocker] ?? blocker}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
