"use client";

import { useState } from "react";
import { BLOCKER_LABELS, api, unwrap } from "@/lib/api";
import { useTaxonomy } from "@/lib/useTaxonomy";

const AGE_GROUPS: Record<string, [number, number]> = { "0_2": [0, 2], "2_4": [2, 4], "4_6": [4, 6] };

/** Bulk publish (items with blockers are skipped and listed) and quick bulk tagging. */
export function BulkBar({ selectedIds, onDone }: { selectedIds: string[]; onDone: () => void }) {
  const taxonomy = useTaxonomy();
  const [reason, setReason] = useState("Reviewed in the Content Studio.");
  const [ageGroup, setAgeGroup] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  async function decide(decision: "APPROVED" | "REJECTED") {
    setBusy(true);
    setMessage(null);
    try {
      const { results } = unwrap(await api.POST("/publication-decisions/bulk", { body: { content_item_ids: selectedIds, decision, reason } }));
      const skipped = results.filter((result) => !result.ok);
      const done = results.length - skipped.length;
      const reasons = [...new Set(skipped.flatMap((result) => result.blockers))].map((blocker) => BLOCKER_LABELS[blocker] ?? blocker);
      setMessage(`${done} ${decision === "APPROVED" ? "published" : "rejected"}${skipped.length ? `, ${skipped.length} skipped (${reasons.join(", ") || "see details"})` : ""}.`);
      onDone();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function applyTags() {
    const changes: Record<string, unknown> = {};
    if (ageGroup) [changes.age_min, changes.age_max] = AGE_GROUPS[ageGroup];
    if (category) changes.category = category;
    if (Object.keys(changes).length === 0) return;
    setBusy(true);
    try {
      const { results } = unwrap(await api.POST("/content-items/bulk-classification", { body: { content_item_ids: selectedIds, changes } }));
      setMessage(`Tags updated on ${results.filter((result) => result.ok).length} item(s).`);
      onDone();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Tagging failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack" style={{ marginBottom: 14 }}>
      <div className="row">
        <strong>{selectedIds.length} selected</strong>
        <input aria-label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} style={{ minWidth: 260 }} />
        <button className="btn good" disabled={busy || reason.trim().length < 3} onClick={() => decide("APPROVED")}>
          Publish selected
        </button>
        <button className="btn" disabled={busy || reason.trim().length < 3} onClick={() => decide("REJECTED")}>
          Reject selected
        </button>
      </div>
      <div className="row">
        <span className="muted">Quick tags:</span>
        <select aria-label="Age group" value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)}>
          <option value="">Age group…</option>
          {taxonomy?.age_group.map((term) => (
            <option key={term.key} value={term.key}>
              {term.label}
            </option>
          ))}
        </select>
        <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Category…</option>
          {taxonomy?.category.map((term) => (
            <option key={term.key} value={term.key}>
              {term.label}
            </option>
          ))}
        </select>
        <button className="btn small" disabled={busy || (!ageGroup && !category)} onClick={applyTags}>
          Apply tags
        </button>
      </div>
      {message && <p className="muted" style={{ margin: 0 }}>{message}</p>}
    </div>
  );
}
