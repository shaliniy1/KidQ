"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getChildren, type ChildProfile } from "@/services/child-profile";
import { startSession, type SessionMode } from "@/services/session";
import { mascotColorForIndex } from "@/lib/mascot-colors";
import { parseDurationPhrase } from "@/lib/duration-parser";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Avatar } from "@/components/Avatar";

const MODE_LABELS: { mode: SessionMode; label: string }[] = [
  { mode: "AUTO", label: "Auto" },
  { mode: "MORNING", label: "Morning" },
  { mode: "DAYTIME", label: "Daytime" },
  { mode: "BEDTIME", label: "Bedtime" },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;

type MicState = "idle" | "listening" | "unsupported";

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
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

/** P7a — the everyday quick action (spec Section 4). */
export default function StartSessionPage() {
  const router = useRouter();
  const status = useSession();
  const [phase, setPhase] = useState<"loading" | "ready" | "starting" | "error">("loading");
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(30);
  const [mode, setMode] = useState<SessionMode>("AUTO");
  const [micState, setMicState] = useState<MicState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    getChildren()
      .then((fetched) => {
        setChildren(fetched);
        if (fetched.length === 1) {
          const only = fetched[0];
          setSelectedChildId(only.id);
          setDuration(only.session_minutes ?? 30);
          setMode(only.session_mode ?? "AUTO");
        }
        setPhase("ready");
      })
      .catch((error) => {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load your children");
      });
  }, [status]);

  function selectChild(child: ChildProfile) {
    setSelectedChildId(child.id);
    setDuration(child.session_minutes ?? 30);
    setMode(child.session_mode ?? "AUTO");
  }

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
      const parsed = parseDurationPhrase(text);
      if (parsed) setDuration(parsed);
    };
    recognition.onerror = () => setMicState("idle");
    recognition.onend = () => setMicState((current) => (current === "listening" ? "idle" : current));
    setMicState("listening");
    recognition.start();
  }

  async function handleStart() {
    if (!selectedChildId) return;
    setPhase("starting");
    setErrorMessage(null);
    try {
      const session = await startSession(selectedChildId, duration, mode);
      try {
        sessionStorage.setItem(`kidq:last-session:${selectedChildId}`, JSON.stringify(session));
      } catch {
        // best-effort only — the player stub just has less to show if this fails
      }
      router.push(`/play/${selectedChildId}`);
    } catch (error) {
      setPhase("ready");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't start the session");
    }
  }

  if (phase === "loading") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--kq-text-secondary)" }}>Loading…</p>
      </main>
    );
  }

  const selectedChild = children.find((c) => c.id === selectedChildId) ?? null;
  const selectedIndex = children.findIndex((c) => c.id === selectedChildId);

  // Multi-child household with nothing picked yet: child-switcher first.
  if (children.length > 1 && !selectedChild) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
        <Card style={{ maxWidth: 420, width: "100%", display: "flex", flexDirection: "column", gap: 16, height: "fit-content" }}>
          <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
            Who&apos;s watching?
          </h1>
          {children.map((child, index) => (
            <button
              key={child.id}
              onClick={() => selectChild(child)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: "var(--kq-radius-control)",
                border: "2px solid var(--kq-border)",
                background: "var(--kq-white)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Avatar color={mascotColorForIndex(index)} label={child.nickname[0]?.toUpperCase() ?? "?"} size={48} />
              <span style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{child.nickname}</span>
            </button>
          ))}
        </Card>
      </main>
    );
  }

  if (!selectedChild) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--kq-terracotta)" }}>No child profile found yet.</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
      <Card style={{ maxWidth: 420, width: "100%", display: "flex", flexDirection: "column", gap: 20, height: "fit-content" }}>
        {children.length > 1 && (
          <button
            onClick={() => setSelectedChildId(null)}
            style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
          >
            ← Switch child
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar color={mascotColorForIndex(Math.max(selectedIndex, 0))} label={selectedChild.nickname[0]?.toUpperCase() ?? "?"} size={48} />
          <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
            {selectedChild.nickname}&apos;s session
          </h1>
        </div>

        <div>
          <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 8 }}>
            Duration
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {DURATION_OPTIONS.map((minutes) => (
              <Pill key={minutes} selected={duration === minutes} onClick={() => setDuration(minutes)}>
                {minutes} min
              </Pill>
            ))}
            <button
              onClick={handleMicTap}
              disabled={micState === "listening"}
              aria-label="Say the duration"
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--kq-radius-pill)",
                border: "none",
                background: micState === "listening" ? "var(--kq-terracotta)" : "var(--kq-saffron)",
                color: "var(--kq-white)",
                cursor: "pointer",
              }}
            >
              🎤
            </button>
          </div>
          {micState === "listening" && (
            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginTop: 6 }}>Listening…</p>
          )}
          {micState === "unsupported" && (
            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginTop: 6 }}>
              Voice isn&apos;t supported in this browser — tap a duration instead
            </p>
          )}
        </div>

        <div>
          <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 8 }}>
            Time of day
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {MODE_LABELS.map(({ mode: m, label }) => (
              <Pill key={m} selected={mode === m} onClick={() => setMode(m)}>
                {label}
              </Pill>
            ))}
          </div>
        </div>

        {errorMessage && <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>}

        <Button variant="primary" disabled={phase === "starting"} onClick={handleStart}>
          {phase === "starting" ? "Starting…" : "Start session"}
        </Button>

        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
          <button
            onClick={() => router.push(`/hub/${selectedChild.id}`)}
            style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", textDecoration: "underline", cursor: "pointer", padding: 8, fontSize: "var(--kq-text-caption)" }}
          >
            Change content preferences
          </button>
          <button
            onClick={() => router.push(`/watched/${selectedChild.id}`)}
            style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", textDecoration: "underline", cursor: "pointer", padding: 8, fontSize: "var(--kq-text-caption)" }}
          >
            Watched videos
          </button>
          <button
            onClick={() => router.push("/videos")}
            style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", textDecoration: "underline", cursor: "pointer", padding: 8, fontSize: "var(--kq-text-caption)" }}
          >
            My Videos
          </button>
          <button
            onClick={() => router.push("/analytics")}
            style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", textDecoration: "underline", cursor: "pointer", padding: 8, fontSize: "var(--kq-text-caption)" }}
          >
            Activity
          </button>
          <button
            onClick={() => router.push("/settings")}
            style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", textDecoration: "underline", cursor: "pointer", padding: 8, fontSize: "var(--kq-text-caption)" }}
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => router.push("/inbox")}
            style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", textDecoration: "underline", cursor: "pointer", padding: 8, fontSize: "var(--kq-text-caption)" }}
          >
            🔔 Notifications
          </button>
        </div>
      </Card>
    </main>
  );
}
