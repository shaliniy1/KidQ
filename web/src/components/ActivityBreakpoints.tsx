"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { getActivities, saveActivityBreakpoints, type ActivityBreakpoint, type ParentActivity } from "@/services/activity-breaks";

function formatTime(value: number) { return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`; }
function parseTime(value: string) {
  const parts = value.trim().split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  return parts.length === 1 ? parts[0] : parts.at(-1)! + (parts.at(-2)! * 60) + (parts.at(-3) ?? 0) * 3600;
}

export function ActivityBreakpoints({ childId, contentItemId, durationSeconds, initial }: { childId: string; contentItemId: string; durationSeconds: number | null; initial: ActivityBreakpoint[] }) {
  const [open, setOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<{ moving: ParentActivity[]; calmer: ParentActivity[] } | null>(null);
  const [points, setPoints] = useState(initial);
  const [activityId, setActivityId] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const activityById = useMemo(() => new Map([...(catalogue?.moving ?? []), ...(catalogue?.calmer ?? [])].map((activity) => [activity.id, activity])), [catalogue]);
  const duration = durationSeconds ?? 0;

  async function openEditor() {
    setOpen(true); setError(null);
    if (!catalogue) setCatalogue(await getActivities());
  }
  function addPoint() {
    if (!durationSeconds) { setError("This video duration is not known yet."); return; }
    const seconds = parseTime(time);
    if (!activityId || seconds === null || seconds < 0 || seconds >= durationSeconds) { setError("This activity time is outside the video duration."); return; }
    if (points.some((point) => point.timestamp_seconds === seconds)) { setError("Only one activity can be set at the same time."); return; }
    setPoints((current) => [...current, { timestamp_seconds: seconds, activity_id: activityId }].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
    setActivityId(""); setTime(""); setError(null);
  }
  async function save() {
    setSaving(true); setError(null);
    try { await saveActivityBreakpoints(childId, contentItemId, points); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save activity breaks."); }
    finally { setSaving(false); }
  }

  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <Button variant="secondary" onClick={() => void openEditor()}>{points.length ? "Edit activity breaks" : "Add activity break"}</Button>
    {points.length > 0 && <div style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}><strong>Activity breaks:</strong> {points.map((point) => `${formatTime(point.timestamp_seconds)} ${activityById.get(point.activity_id)?.title ?? "Activity"}`).join(" · ")}</div>}
    {open && <div role="dialog" aria-label="Activity breaks" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, borderRadius: 12, background: "var(--kq-cream)", border: "1px solid var(--kq-border)" }}>
      <strong>Choose an activity and time</strong>
      <select aria-label="Activity" value={activityId} onChange={(e) => setActivityId(e.target.value)} style={{ minHeight: 44 }}><option value="">Select activity</option><optgroup label="Moving">{catalogue?.moving.map((a) => <option key={a.id} value={a.id}>{a.title} · {a.duration_seconds}s</option>)}</optgroup><optgroup label="Calmer">{catalogue?.calmer.map((a) => <option key={a.id} value={a.id}>{a.title} · {a.duration_seconds}s</option>)}</optgroup></select>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Show at <input aria-label="Show at" inputMode="numeric" placeholder="mm:ss" value={time} onChange={(e) => setTime(e.target.value)} style={{ minHeight: 44, padding: "0 10px" }} /><small>Video duration: {formatTime(duration)}. Breaks must be before the end.</small></label>
      <input aria-label="Activity timeline" type="range" min={0} max={Math.max(0, duration - 1)} value={parseTime(time) ?? 0} onChange={(e) => setTime(formatTime(Number(e.target.value)))} disabled={!durationSeconds} />
      <Button variant="secondary" onClick={addPoint}>Add to this video</Button>
      {points.map((point) => <div key={`${point.timestamp_seconds}-${point.activity_id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{formatTime(point.timestamp_seconds)} · {activityById.get(point.activity_id)?.title ?? "Activity"}</span><button onClick={() => setPoints((current) => current.filter((candidate) => candidate !== point))} style={{ color: "var(--kq-terracotta)", background: "none", border: 0 }}>Remove</button></div>)}
      {error && <p role="alert" style={{ color: "var(--kq-terracotta)", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save activity breaks"}</Button><Button variant="secondary" onClick={() => { setPoints(initial); setOpen(false); }}>Cancel</Button></div>
    </div>}
  </div>;
}
