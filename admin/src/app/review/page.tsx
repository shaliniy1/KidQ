"use client";

import { useCallback, useEffect, useState } from "react";
import { BulkBar } from "@/components/BulkBar";
import { ContentTable } from "@/components/ContentTable";
import { api, unwrap, type AdminContent } from "@/lib/api";

export default function ReviewQueuePage() {
  const [items, setItems] = useState<AdminContent[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const page = unwrap(await api.GET("/review-queue", { params: { query: { limit: 100, offset: 0 } } }));
      setItems(page.items);
      setTotal(page.total);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load the review queue.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ready = items.filter((item) => item.studio_state === "READY_TO_APPROVE").map((item) => item.id);
  return (
    <div>
      <h1>Review queue</h1>
      <p className="muted">
        {total} item(s) waiting for a decision. Parent requests come first. Nothing reaches families until you publish it.
      </p>
      <div className="toolbar">
        <button className="btn small" disabled={ready.length === 0} onClick={() => setSelected(new Set(ready))}>
          Select all ready to approve ({ready.length})
        </button>
      </div>
      <BulkBar
        selectedIds={[...selected]}
        onDone={() => {
          setSelected(new Set());
          void load();
        }}
      />
      {error && <p className="error">{error}</p>}
      <ContentTable
        items={items}
        selected={selected}
        onToggle={(id) =>
          setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onToggleAll={(ids, checked) => setSelected(checked ? new Set(ids) : new Set())}
      />
    </div>
  );
}
