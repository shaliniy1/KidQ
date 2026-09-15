"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { KidQUser } from "@/services/auth";
import { onAuthChange } from "@/services/auth";
import { getChildren } from "@/services/child-profile";
import { getCurationSettings, saveCurationSettings } from "@/services/curation-settings";
import { BREAK_TYPES, type BreakType, type CurationSettings } from "@/types/curation-settings";
import type { ChildProfile } from "@/types/child-profile";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Avatar } from "@/components/Avatar";

type Draft = Omit<CurationSettings, "childId" | "updatedAt">;

/** P7 Settings — rarely-changed defaults (spec Section 11 #7), per child. */
export default function SettingsPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userRef = useRef<KidQUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      userRef.current = user;
      try {
        const fetched = await getChildren(user);
        setChildren(fetched);
        if (fetched.length === 1) setSelectedChildId(fetched[0].id);
        setPhase("ready");
      } catch (error) {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load your children");
      }
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!selectedChildId || !userRef.current) return;
    getCurationSettings(userRef.current, selectedChildId).then((settings) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { childId, updatedAt, ...rest } = settings;
      setDraft(rest);
    });
  }, [selectedChildId]);

  function patchDraft(patch: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  async function handleSave() {
    if (!draft || !selectedChildId || !userRef.current) return;
    setPhase("saving");
    setErrorMessage(null);
    try {
      await saveCurationSettings(userRef.current, selectedChildId, draft);
      router.push("/session");
    } catch (error) {
      setPhase("ready");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't save settings");
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

  if (children.length > 1 && !selectedChild) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
        <Card style={{ maxWidth: 420, width: "100%", display: "flex", flexDirection: "column", gap: 16, height: "fit-content" }}>
          <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
            Settings for which child?
          </h1>
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: "var(--kq-radius-control)", border: "2px solid var(--kq-border)", background: "var(--kq-white)", cursor: "pointer", textAlign: "left" }}
            >
              <Avatar color={child.mascotColor} label={child.nickname[0]?.toUpperCase() ?? "?"} size={48} />
              <span style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{child.nickname}</span>
            </button>
          ))}
        </Card>
      </main>
    );
  }

  if (!draft || !selectedChild) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--kq-text-secondary)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
      <Card style={{ maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 18, height: "fit-content" }}>
        <button
          onClick={() => router.push("/session")}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
        >
          ← Back
        </button>

        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          {selectedChild.nickname}&apos;s settings
        </h1>

        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <span style={{ color: "var(--kq-charcoal)" }}>Autoplay</span>
          <input type="checkbox" checked={draft.autoplay} onChange={(e) => patchDraft({ autoplay: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--kq-teal)" }} />
        </label>

        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <span style={{ color: "var(--kq-charcoal)" }}>Sensory-friendly mode</span>
          <input type="checkbox" checked={draft.sensoryMode} onChange={(e) => patchDraft({ sensoryMode: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--kq-teal)" }} />
        </label>

        <div>
          <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 8 }}>
            Break type default
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {BREAK_TYPES.map((type) => (
              <Pill key={type.value} selected={draft.breakType === type.value} onClick={() => patchDraft({ breakType: type.value as BreakType })}>
                {type.label}
              </Pill>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--kq-border)", paddingTop: 14 }}>
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: 10 }}>
            <span style={{ color: "var(--kq-charcoal)" }}>Daily schedule</span>
            <input
              type="checkbox"
              checked={draft.dailySchedule.enabled}
              onChange={(e) => patchDraft({ dailySchedule: { ...draft.dailySchedule, enabled: e.target.checked } })}
              style={{ width: 22, height: 22, accentColor: "var(--kq-teal)" }}
            />
          </label>
          {draft.dailySchedule.enabled && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="time"
                value={draft.dailySchedule.startTime}
                onChange={(e) => patchDraft({ dailySchedule: { ...draft.dailySchedule, startTime: e.target.value } })}
                style={{ height: 40, borderRadius: "var(--kq-radius-control)", border: "2px solid var(--kq-border)", padding: "0 8px" }}
              />
              <span style={{ color: "var(--kq-text-secondary)" }}>to</span>
              <input
                type="time"
                value={draft.dailySchedule.endTime}
                onChange={(e) => patchDraft({ dailySchedule: { ...draft.dailySchedule, endTime: e.target.value } })}
                style={{ height: 40, borderRadius: "var(--kq-radius-control)", border: "2px solid var(--kq-border)", padding: "0 8px" }}
              />
            </div>
          )}
          <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginTop: 6 }}>
            Reminder only — a session starting outside this window still works, just shows a gentle note.
          </p>
        </div>

        {errorMessage && <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>}

        <Button variant="primary" disabled={phase === "saving"} onClick={handleSave}>
          {phase === "saving" ? "Saving…" : "Save"}
        </Button>

        <button
          onClick={() => router.push(`/hub/${selectedChild.id}`)}
          style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", textDecoration: "underline", cursor: "pointer", padding: 8, fontSize: "var(--kq-text-caption)" }}
        >
          Content & curation preferences
        </button>
      </Card>
    </main>
  );
}
