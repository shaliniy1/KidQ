"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { KidQUser } from "@/services/auth";
import { onAuthChange } from "@/services/auth";
import { extractCurationTags } from "@/services/curation-nlu";
import { writeHubDraftPatch } from "@/lib/hub-draft-bridge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

type MicState = "idle" | "listening" | "done" | "unsupported";

// Web Speech API isn't in the standard lib.dom types under this name in
// every TS/lib config; declared narrowly here rather than widening a
// project-global type just for this one optional feature.
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * "Talk or type to KidQ" — voice/text capture for curation (spec Section 8,
 * Section 11 #16.2). Speech-to-text runs entirely on-device in the browser
 * (spec Section 11 #25) — only the resulting text is ever sent to the
 * backend, never audio.
 */
export default function VoiceCapturePage() {
  const router = useRouter();
  const params = useParams<{ childId: string }>();
  const childId = params.childId;

  const [micState, setMicState] = useState<MicState>("idle");
  const [transcript, setTranscript] = useState("");
  const [phase, setPhase] = useState<"ready" | "submitting" | "error">("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userRef = useRef<KidQUser | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      userRef.current = user;
    });
    return unsubscribe;
  }, [router]);

  function handleMicTap() {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setMicState("unsupported");
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setTranscript((current) => (current ? `${current} ${text}` : text));
      setMicState("done");
    };
    recognition.onerror = () => setMicState("idle");
    recognition.onend = () => setMicState((current) => (current === "listening" ? "idle" : current));
    recognitionRef.current = recognition;
    setMicState("listening");
    recognition.start();
  }

  async function handleUseThis() {
    if (!transcript.trim() || !userRef.current) return;
    setPhase("submitting");
    setErrorMessage(null);
    try {
      const result = await extractCurationTags(userRef.current, transcript.trim());
      writeHubDraftPatch(childId, result);
      router.push(`/hub/${childId}`);
    } catch (error) {
      setPhase("ready");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't process that — try again");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
      <Card style={{ maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 18, height: "fit-content" }}>
        <button
          onClick={() => router.push(`/hub/${childId}`)}
          aria-label="Back"
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
        >
          ← Back
        </button>

        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          Talk or type to KidQ
        </h1>
        <p style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-body)" }}>
          Tell us what your child likes, e.g. &ldquo;calming animal stories before bed&rdquo;. We&apos;ll fill
          in what we can — you can review and adjust everything back on the Hub.
        </p>

        <button
          onClick={handleMicTap}
          disabled={micState === "listening" || micState === "unsupported"}
          aria-label="Start voice input"
          style={{
            alignSelf: "center",
            width: 72,
            height: 72,
            borderRadius: "var(--kq-radius-pill)",
            border: "none",
            background: micState === "listening" ? "var(--kq-terracotta)" : "var(--kq-saffron)",
            color: "var(--kq-white)",
            fontSize: 28,
            cursor: micState === "unsupported" ? "not-allowed" : "pointer",
          }}
        >
          🎤
        </button>
        <p style={{ textAlign: "center", fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
          {micState === "listening" && "Listening…"}
          {micState === "unsupported" && "Voice isn't supported in this browser — type instead"}
          {(micState === "idle" || micState === "done") && "Tap to speak, or type below"}
        </p>

        <textarea
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="Or type here…"
          rows={3}
          style={{
            borderRadius: "var(--kq-radius-control)",
            border: "2px solid var(--kq-border)",
            padding: 12,
            fontSize: "var(--kq-text-body)",
            fontFamily: "var(--kq-font-body)",
            resize: "vertical",
          }}
        />

        {errorMessage && <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>}

        <Button variant="primary" disabled={!transcript.trim() || phase === "submitting"} onClick={handleUseThis}>
          {phase === "submitting" ? "Working…" : "Use this"}
        </Button>
      </Card>
    </main>
  );
}
