"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getChildren } from "@/services/child-profile";
import { previewVideo, submitVideo, type SubmissionPreview } from "@/services/my-videos";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type Preview = SubmissionPreview & { score?: number | null; reason?: string | null };
type PdfItem = { url: string; preview?: Preview; status: "checking" | "ready" | "failed"; selected: boolean; error?: string };

export default function AddVideoPage() {
  const router = useRouter();
  const status = useSession();
  const [childId, setChildId] = useState<string | null>(null);
  const [mode, setMode] = useState<"url" | "pdf">("url");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pdfItems, setPdfItems] = useState<PdfItem[]>([]);
  const [phase, setPhase] = useState<"idle" | "checking" | "ready" | "submitting" | "submitted" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (status === "anon") router.replace("/login"); }, [status, router]);
  useEffect(() => { if (status === "authed") getChildren().then((children) => setChildId(children[0]?.id ?? null)); }, [status]);

  async function checkUrl() {
    if (!url.trim() || !childId) return;
    setPhase("checking"); setErrorMessage(null);
    try { setPreview(await previewVideo(childId, url.trim()) as Preview); setPhase("ready"); }
    catch (error) { setPhase("error"); setErrorMessage(error instanceof Error ? error.message : "Couldn&apos;t check that video"); }
  }

  async function readPdf(file: File) {
    if (!childId) return;
    setPhase("checking"); setErrorMessage(null);
    const urls = [...new Set((await file.text()).match(/https?:\/\/[^\s<>"']+/g) ?? [])].filter((item) => /youtube\.com|youtu\.be/i.test(item));
    if (!urls.length) { setPhase("error"); setErrorMessage("No supported YouTube URLs were found in that PDF."); return; }
    const initial = urls.map((item) => ({ url: item, status: "checking" as const, selected: false }));
    setPdfItems(initial);
    const checked = await Promise.all(initial.map(async (item) => {
      try { return { ...item, preview: await previewVideo(childId, item.url) as Preview, status: "ready" as const, selected: true }; }
      catch (error) { return { ...item, status: "failed" as const, error: error instanceof Error ? error.message : "Couldn&apos;t score this URL" }; }
    }));
    setPdfItems(checked); setPhase("ready");
  }

  async function submitOne(itemUrl: string) {
    if (!childId) return;
    await submitVideo(childId, itemUrl, "PRIVATE");
  }

  async function addUrl() {
    if (!preview) return;
    setPhase("submitting"); setErrorMessage(null);
    try { await submitOne(url.trim()); setPhase("submitted"); }
    catch (error) { setPhase("ready"); setErrorMessage(error instanceof Error ? error.message : "Couldn&apos;t add that video"); }
  }

  async function addPdfItems() {
    const selected = pdfItems.filter((item) => item.selected && item.preview);
    if (!selected.length) return;
    setPhase("submitting"); setErrorMessage(null);
    const results = await Promise.allSettled(selected.map((item) => submitOne(item.url)));
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed === selected.length) { setPhase("error"); setErrorMessage("None of the selected items could be added."); return; }
    setPhase("submitted");
    if (failed) setErrorMessage(`${failed} item${failed === 1 ? "" : "s"} could not be added; the rest were saved.`);
  }

  if (phase === "submitted") return <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: 24 }}><Card style={{ maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}><h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>Added to Your Q</h1><p style={{ color: "var(--kq-text-secondary)" }}>KidQ saved this content privately for your family. It will not be suggested to other families.</p>{errorMessage && <p style={{ color: "var(--kq-terracotta)" }}>{errorMessage}</p>}<Button variant="primary" onClick={() => router.push("/videos")}>Back to My Videos</Button></Card></main>;

  const score = preview?.score;
  const scoreLabel = score === null || score === undefined ? "Score pending" : score >= 60 ? `Good score · ${score}/100` : `Needs review · ${score}/100`;
  return <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: 24 }}><Card style={{ maxWidth: 520, width: "100%", display: "flex", flexDirection: "column", gap: 18, height: "fit-content" }}>
    <button onClick={() => router.push("/videos")} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}>← Back</button>
    <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>Add content</h1>
    <div style={{ display: "flex", gap: 8 }}><Button variant={mode === "url" ? "primary" : "secondary"} onClick={() => setMode("url")}>URL</Button><Button variant={mode === "pdf" ? "primary" : "secondary"} onClick={() => setMode("pdf")}>PDF</Button></div>
    {mode === "url" ? <>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>Supported URL</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" style={{ height: "var(--kq-tap-min)", borderRadius: "var(--kq-radius-control)", border: "2px solid var(--kq-border)", padding: "0 14px", fontSize: "var(--kq-text-body)", fontFamily: "var(--kq-font-body)" }} /></label>
      {!preview && <Button variant="primary" disabled={!url.trim() || phase === "checking" || !childId} onClick={checkUrl}>{phase === "checking" ? "Scoring…" : "Check this content"}</Button>}
      {preview && <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}><strong style={{ color: "var(--kq-charcoal)" }}>{preview.title}</strong>{preview.thumbnail_url && <img src={preview.thumbnail_url} alt="" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "contain", background: "var(--kq-charcoal)", borderRadius: "var(--kq-radius-card)" }} />}<span style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-caption)" }}>{preview.channel ?? "Unknown channel"} · {scoreLabel}</span><p style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-caption)", margin: 0 }}>{preview.reason ?? preview.kidq_check.note ?? "KidQ scoring details are pending."}</p>{score !== null && score !== undefined && score < 60 && <p style={{ color: "var(--kq-terracotta)", fontWeight: 700, margin: 0 }}>This content scored {score}/100 and needs review. Do you still want to add it privately for your family?</p>}<Button variant="primary" disabled={phase === "submitting"} onClick={addUrl}>{phase === "submitting" ? "Adding…" : score !== null && score !== undefined && score < 60 ? "Add anyway, privately" : "Add privately to Your Q"}</Button></Card>}
    </> : <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, border: "2px dashed var(--kq-border)", borderRadius: "var(--kq-radius-control)", padding: 20, color: "var(--kq-text-secondary)" }}><span>Upload a PDF with supported video links</span><input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readPdf(file); }} style={{ display: "none" }} /><Button type="button" variant="secondary" onClick={() => pdfInputRef.current?.click()}>Upload PDF</Button></div>
      {pdfItems.map((item) => <Card key={item.url} style={{ display: "flex", flexDirection: "column", gap: 8 }}><label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="checkbox" checked={item.selected} disabled={item.status !== "ready"} onChange={() => setPdfItems((current) => current.map((candidate) => candidate.url === item.url ? { ...candidate, selected: !candidate.selected } : candidate))} /><span style={{ flex: 1, color: "var(--kq-charcoal)" }}>{item.preview?.title ?? item.url}</span></label><span style={{ color: item.status === "failed" ? "var(--kq-terracotta)" : "var(--kq-text-secondary)", fontSize: "var(--kq-text-caption)" }}>{item.status === "checking" ? "Scoring…" : item.status === "failed" ? item.error : `${item.preview?.score ?? "Score pending"} · ${item.preview?.reason ?? "Ready for review"}`}</span></Card>)}
      {pdfItems.some((item) => item.selected) && <Button variant="primary" disabled={phase === "submitting"} onClick={addPdfItems}>{phase === "submitting" ? "Adding selected…" : "Add selected to Your Q"}</Button>}
    </>}
    {errorMessage && <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>}
  </Card></main>;
}
