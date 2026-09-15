"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";
import { onAuthChange } from "@/services/auth";
import { getCategories } from "@/services/parent-config";
import { getCurationSettings, saveCurationSettings } from "@/services/curation-settings";
import { readAndClearHubDraftPatch } from "@/lib/hub-draft-bridge";
import {
  BREAK_INTERVAL_OPTIONS,
  BREAK_TYPES,
  DURATION_OPTIONS,
  REGULATION_GOALS,
  computeBreakCount,
  type BreakType,
  type ContentMixMode,
  type CurationSettings,
} from "@/types/curation-settings";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";

type Draft = Omit<CurationSettings, "childId" | "updatedAt">;

function summarizeInterests(interests: string[]): string {
  if (interests.length === 0) return "None selected";
  if (interests.length <= 2) return interests.join(", ");
  return `${interests.slice(0, 2).join(", ")} +${interests.length - 2}`;
}

function summarizeContentMix(draft: Draft): string {
  if (draft.contentMixMode === "surprise_us") return "Surprise us — a good age-appropriate mix";
  return draft.contentMixCategories.length === 0
    ? "Let me choose categories — none chosen yet"
    : `Categories: ${summarizeInterests(draft.contentMixCategories)}`;
}

function summarizeRegulation(goals: string[]): string {
  if (goals.length === 0) return "No restriction — any goal can be included";
  const labels = REGULATION_GOALS.filter((g) => goals.includes(g.tag)).map((g) => g.label);
  return summarizeInterests(labels);
}

function summarizeScreenTime(draft: Draft): string {
  const breaks = computeBreakCount(draft.durationDefault, draft.breakInterval);
  const breakTypeLabel = BREAK_TYPES.find((t) => t.value === draft.breakType)?.label ?? draft.breakType;
  return `${draft.durationDefault} min · every ${draft.breakInterval} min (${breaks} break${breaks === 1 ? "" : "s"}) · ${breakTypeLabel}`;
}

function HubRow({
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--kq-border)", paddingTop: 16 }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          textAlign: "left",
        }}
      >
        <div>
          <p className="kq-heading" style={{ fontSize: "var(--kq-text-body)", fontWeight: 700, color: "var(--kq-charcoal)" }}>
            {title}
          </p>
          <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginTop: 2 }}>{summary}</p>
        </div>
        <span style={{ color: "var(--kq-text-secondary)", fontSize: 18 }}>{expanded ? "−" : "+"}</span>
      </button>
      {expanded && <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>}
    </div>
  );
}

export default function HubPage() {
  const router = useRouter();
  const params = useParams<{ childId: string }>();
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams.get("from") === "onboarding";
  const childId = params.childId;

  const [phase, setPhase] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [categories, setCategories] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      userRef.current = user;
      try {
        const [{ categories: cats }, settings] = await Promise.all([
          getCategories(),
          getCurationSettings(user, childId),
        ]);
        setCategories(cats);
        // A voice or guided-questions capture screen may have just handed
        // back a patch (sessionStorage bridge, never the backend — ticket
        // 05's "nothing persists until Done" stays true either way).
        const incomingPatch = readAndClearHubDraftPatch(childId);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { childId: _childId, updatedAt: _updatedAt, ...settingsRest } = settings;
        setDraft({
          ...settingsRest, // carries autoplay/sensoryMode/dailySchedule (Settings' fields, ticket 13) through untouched
          interests: incomingPatch?.interests ?? settings.interests,
          contentMixMode: incomingPatch?.contentMixMode ?? settings.contentMixMode,
          contentMixCategories: incomingPatch?.contentMixCategories ?? settings.contentMixCategories,
          regulationGoals: incomingPatch?.regulationGoals ?? settings.regulationGoals,
        });
        setPhase("ready");
      } catch (error) {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load curation settings");
      }
    });
    return unsubscribe;
  }, [router, childId]);

  function patchDraft(patch: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  /**
   * Toggles `value` in a list field entirely inside the setState updater,
   * against the freshest `current` — not a `draft.someList` read taken at
   * click time. Two pill taps issued before React commits the first
   * re-render would otherwise both close over the same stale list and the
   * first toggle would be silently lost (found via interaction testing).
   */
  function toggleListField(field: "interests" | "contentMixCategories" | "regulationGoals", value: string) {
    setDraft((current) => {
      if (!current) return current;
      const list = current[field];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...current, [field]: next };
    });
  }

  async function handleFinish() {
    if (!draft || !userRef.current) return;
    setPhase("saving");
    setErrorMessage(null);
    try {
      await saveCurationSettings(userRef.current, childId, draft);
      router.push("/session");
    } catch (error) {
      setPhase("ready");
      setErrorMessage(error instanceof Error ? error.message : "Couldn't save your changes");
    }
  }

  function handleNeverMind() {
    // Discards local edits (nothing was saved) and goes straight to P7a —
    // spec Section 11 #17.
    router.push("/session");
  }

  if (phase === "loading" || !draft) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--kq-text-secondary)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
      <Card style={{ maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", gap: 16, height: "fit-content" }}>
        <button
          onClick={() => router.push(fromOnboarding ? "/onboarding/confirm" : "/session")}
          aria-label="Back"
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
        >
          ← Back
        </button>

        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          Customize & curation
        </h1>

        <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)" }}>
          Tap through the fields below, or use a shortcut to fill them in for you:
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" onClick={() => router.push(`/hub/${childId}/voice`)}>
            🎤 Talk or type to KidQ
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/hub/${childId}/guided`)}>
            Guided questions
          </Button>
        </div>

        <HubRow
          title="Interests"
          summary={summarizeInterests(draft.interests)}
          expanded={expandedRow === "interests"}
          onToggle={() => setExpandedRow(expandedRow === "interests" ? null : "interests")}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {categories.map((category) => (
              <Pill
                key={category}
                selected={draft.interests.includes(category)}
                onClick={() => toggleListField("interests", category)}
              >
                {category}
              </Pill>
            ))}
          </div>
        </HubRow>

        <HubRow
          title="Content mix"
          summary={summarizeContentMix(draft)}
          expanded={expandedRow === "contentMix"}
          onToggle={() => setExpandedRow(expandedRow === "contentMix" ? null : "contentMix")}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="radio"
              checked={draft.contentMixMode === "surprise_us"}
              onChange={() => patchDraft({ contentMixMode: "surprise_us" as ContentMixMode })}
            />
            Surprise us — a good age-appropriate mix
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="radio"
              checked={draft.contentMixMode === "choose_categories"}
              onChange={() => patchDraft({ contentMixMode: "choose_categories" as ContentMixMode })}
            />
            Let me choose categories
          </label>
          {draft.contentMixMode === "choose_categories" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginLeft: 24 }}>
              {categories.map((category) => (
                <Pill
                  key={category}
                  selected={draft.contentMixCategories.includes(category)}
                  onClick={() => toggleListField("contentMixCategories", category)}
                >
                  {category}
                </Pill>
              ))}
            </div>
          )}
        </HubRow>

        <HubRow
          title="Regulation goal"
          summary={summarizeRegulation(draft.regulationGoals)}
          expanded={expandedRow === "regulation"}
          onToggle={() => setExpandedRow(expandedRow === "regulation" ? null : "regulation")}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {REGULATION_GOALS.map((goal) => (
              <Pill
                key={goal.tag}
                selected={draft.regulationGoals.includes(goal.tag)}
                onClick={() => toggleListField("regulationGoals", goal.tag)}
              >
                {goal.label}
              </Pill>
            ))}
          </div>
        </HubRow>

        <HubRow
          title="Screen time & breaks"
          summary={summarizeScreenTime(draft)}
          expanded={expandedRow === "screenTime"}
          onToggle={() => setExpandedRow(expandedRow === "screenTime" ? null : "screenTime")}
        >
          <div>
            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 6 }}>Duration</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DURATION_OPTIONS.map((minutes) => (
                <Pill key={minutes} selected={draft.durationDefault === minutes} onClick={() => patchDraft({ durationDefault: minutes })}>
                  {minutes} min
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 6 }}>Break every</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BREAK_INTERVAL_OPTIONS.map((minutes) => (
                <Pill key={minutes} selected={draft.breakInterval === minutes} onClick={() => patchDraft({ breakInterval: minutes })}>
                  {minutes} min
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 6 }}>Break type</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BREAK_TYPES.map((type) => (
                <Pill key={type.value} selected={draft.breakType === type.value} onClick={() => patchDraft({ breakType: type.value as BreakType })}>
                  {type.label}
                </Pill>
              ))}
            </div>
          </div>
        </HubRow>

        {errorMessage && <p style={{ color: "var(--kq-terracotta)", fontSize: "var(--kq-text-caption)" }}>{errorMessage}</p>}

        <Button variant="primary" disabled={phase === "saving"} onClick={handleFinish}>
          {phase === "saving" ? "Saving…" : fromOnboarding ? "Done — start using KidQ" : "Save & back"}
        </Button>

        <button
          onClick={handleNeverMind}
          style={{ background: "none", border: "none", color: "var(--kq-text-secondary)", textDecoration: "underline", cursor: "pointer", padding: 8, fontSize: "var(--kq-text-caption)" }}
        >
          Never mind — use KidQ&apos;s recommendation instead
        </button>
      </Card>
    </main>
  );
}
