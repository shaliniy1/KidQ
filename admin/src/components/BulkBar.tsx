"use client";

import { useState } from "react";
import { BLOCKER_LABELS, api, friendlyError, unwrap } from "@/lib/api";
import { ageRange, useTaxonomy } from "@/lib/useTaxonomy";

/** Bulk publish (items with blockers are skipped and listed) and quick bulk tagging. */
export function BulkBar({ selectedIds, onDone }: { selectedIds: string[]; onDone: () => void }) {
  const taxonomy = useTaxonomy();
  const reason = "Reviewed by the KidQ content team.";
  const [ageGroup, setAgeGroup] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // After publishing, the selection clears; keep the bar long enough to show what happened.
  if (selectedIds.length === 0) return message ? <div className="selection-bar"><p className="selection-message">{message}</p></div> : null;

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
      setMessage(friendlyError(failure, "The selected content could not be updated. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function applyTags() {
    const changes: Record<string, unknown> = {};
    const range = ageRange(taxonomy, ageGroup);
    if (range) [changes.age_min, changes.age_max] = range;
    if (category) changes.category = category;
    if (Object.keys(changes).length === 0) return;
    setBusy(true);
    try {
      const { results } = unwrap(await api.POST("/content-items/bulk-classification", { body: { content_item_ids: selectedIds, changes } }));
      setMessage(`Tags updated on ${results.filter((result) => result.ok).length} item(s).`);
      onDone();
    } catch (failure) {
      setMessage(friendlyError(failure, "The category or age group could not be saved. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="selection-bar">
      <div className="selection-actions">
        <strong>{selectedIds.length} selected</strong>
        <button className="btn good small" disabled={busy} onClick={() => decide("APPROVED")}>
          Publish
        </button>
        <button className="btn small" disabled={busy} onClick={() => decide("REJECTED")}>
          Mark needs changes
        </button>
        <details className="bulk-edit">
          <summary>Edit category or age</summary>
          <div className="bulk-edit-menu">
            <select aria-label="Age group" value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)}>
              <option value="">Keep age group</option>
              {taxonomy?.age_group.map((term) => <option key={term.key} value={term.key}>{term.label}</option>)}
            </select>
            <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Keep category</option>
              {taxonomy?.category.map((term) => <option key={term.key} value={term.key}>{term.label}</option>)}
            </select>
            <button className="btn primary small" disabled={busy || (!ageGroup && !category)} onClick={applyTags}>Save</button>
          </div>
        </details>
      </div>
      {message && <p className="selection-message">{message}</p>}
    </div>
  );
}
