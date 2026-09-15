"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getChildren, type ChildProfile } from "@/services/child-profile";
import { getCurationSettings, saveCurationSettings } from "@/services/curation-settings";
import { getLocalPreferences, saveLocalPreferences, type LocalPreferences } from "@/services/local-preferences";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Avatar } from "@/components/Avatar";
import { mascotColorForIndex } from "@/lib/mascot-colors";

const BREAK_TYPES: { label: string; value: "MOVEMENT" | "QUIET" | "ALTERNATE" }[] = [
  { label: "Movement", value: "MOVEMENT" },
  { label: "Quiet-calm", value: "QUIET" },
  { label: "Let KidQ alternate", value: "ALTERNATE" },
];

/** P7 Settings — rarely-changed defaults (spec Section 11 #7), per child. */
export default function SettingsPage() {
  const router = useRouter();
  const status = useSession();
  const [phase, setPhase] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [breakType, setBreakType] = useState<"MOVEMENT" | "QUIET" | "ALTERNATE">("ALTERNATE");
  const [local, setLocal] = useState<LocalPreferences | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    getChildren()
      .then((fetched) => {
        setChildren(fetched);
        if (fetched.length === 1) setSelectedChildId(fetched[0].id);
        setPhase("ready");
      })
      .catch((error) => {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load your children");
      });
  }, [status]);

  useEffect(() => {
    if (!selectedChildId) return;
    getCurationSettings(selectedChildId).then((settings) => {
      if (settings.break_type) setBreakType(settings.break_type);
    });
    setLocal(getLocalPreferences(selectedChildId));
  }, [selectedChildId]);

  async function handleSave() {
    if (!selectedChildId || !local) return;
    setPhase("saving");
    setErrorMessage(null);
    try {
      await saveCurationSettings(selectedChildId, { break_type: breakType });
      saveLocalPreferences(selectedChildId, local);
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
          {children.map((child, index) => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: "var(--kq-radius-control)", border: "2px solid var(--kq-border)", background: "var(--kq-white)", cursor: "pointer", textAlign: "left" }}
            >
              <Avatar color={mascotColorForIndex(index)} label={child.nickname[0]?.toUpperCase() ?? "?"} size={48} />
              <span style={{ fontWeight: 700, color: "var(--kq-charcoal)" }}>{child.nickname}</span>
            </button>
          ))}
        </Card>
      </main>
    );
  }

  if (!local || !selectedChild) {
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
          <input
            type="checkbox"
            checked={local.autoplay}
            onChange={(e) => setLocal({ ...local, autoplay: e.target.checked })}
            style={{ width: 22, height: 22, accentColor: "var(--kq-teal)" }}
          />
        </label>

        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <span style={{ color: "var(--kq-charcoal)" }}>Sensory-friendly mode</span>
          <input
            type="checkbox"
            checked={local.sensoryMode}
            onChange={(e) => setLocal({ ...local, sensoryMode: e.target.checked })}
            style={{ width: 22, height: 22, accentColor: "var(--kq-teal)" }}
          />
        </label>

        <div>
          <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 8 }}>
            Break type default
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {BREAK_TYPES.map((type) => (
              <Pill key={type.value} selected={breakType === type.value} onClick={() => setBreakType(type.value)}>
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
              checked={local.dailySchedule.enabled}
              onChange={(e) => setLocal({ ...local, dailySchedule: { ...local.dailySchedule, enabled: e.target.checked } })}
              style={{ width: 22, height: 22, accentColor: "var(--kq-teal)" }}
            />
          </label>
          {local.dailySchedule.enabled && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="time"
                value={local.dailySchedule.startTime}
                onChange={(e) => setLocal({ ...local, dailySchedule: { ...local.dailySchedule, startTime: e.target.value } })}
                style={{ height: 40, borderRadius: "var(--kq-radius-control)", border: "2px solid var(--kq-border)", padding: "0 8px" }}
              />
              <span style={{ color: "var(--kq-text-secondary)" }}>to</span>
              <input
                type="time"
                value={local.dailySchedule.endTime}
                onChange={(e) => setLocal({ ...local, dailySchedule: { ...local.dailySchedule, endTime: e.target.value } })}
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
