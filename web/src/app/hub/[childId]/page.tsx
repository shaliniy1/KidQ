"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { getTaxonomy } from "@/services/parent-config";
import { getCurationSettings, saveCurationSettings, type CurationSettings } from "@/services/curation-settings";
import { readAndClearHubDraftPatch } from "@/lib/hub-draft-bridge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";

const DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;
const BREAK_INTERVAL_OPTIONS = [10, 15, 20] as const;
const BREAK_TYPES: { label: string; value: NonNullable<CurationSettings["break_type"]> }[] = [
  { label: "Movement", value: "MOVEMENT" },
  { label: "Quiet-calm", value: "QUIET" },
  { label: "Let KidQ alternate", value: "ALTERNATE" },
];

function summarizeList(items: string[]): string {
  if (items.length === 0) return "None selected";
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} +${items.length - 2}`;
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
  const status = useSession();
  const params = useParams<{ childId: string }>();
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams.get("from") === "onboarding";
  const childId = params.childId;

  const [phase, setPhase] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [interestOptions, setInterestOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [regulationOptions, setRegulationOptions] = useState<{ key: string; label: string }[]>([]);
  const [draft, setDraft] = useState<CurationSettings | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed") return;
    Promise.all([getTaxonomy(), getCurationSettings(childId)])
      .then(([taxonomy, settings]) => {
        setInterestOptions((taxonomy.interest ?? []).map((t) => t.label));
        setCategoryOptions((taxonomy.parent_category ?? []).map((t) => t.label));
        setRegulationOptions((taxonomy.regulation_goal ?? []).map((t) => ({ key: t.key, label: t.label })));
        // A voice or guided-questions capture screen may have just handed
        // back a patch (sessionStorage bridge, never the backend — ticket
        // 05's "nothing persists until Done" stays true either way).
        const incomingPatch = readAndClearHubDraftPatch(childId);
        setDraft({
          ...settings,
          interests: incomingPatch?.interests ?? settings.interests,
          preferred_categories: incomingPatch?.contentMixCategories ?? settings.preferred_categories,
          content_mix: incomingPatch?.contentMixMode === "choose_categories" ? "CHOSEN" : settings.content_mix,
          regulation_goals: incomingPatch?.regulationGoals ?? settings.regulation_goals,
        });
        setPhase("ready");
      })
      .catch((error) => {
        setPhase("error");
        setErrorMessage(error instanceof Error ? error.message : "Couldn't load curation settings");
      });
  }, [status, childId]);

  function patchDraft(patch: Partial<CurationSettings>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function toggleListField(field: "interests" | "preferred_categories", value: string) {
    setDraft((current) => {
      if (!current) return current;
      const list = current[field] ?? [];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...current, [field]: next };
    });
  }

  function toggleRegulationGoal(value: string) {
    setDraft((current) => {
      if (!current) return current;
      const list = current.regulation_goals ?? [];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...current, regulation_goals: next };
    });
  }

  async function handleFinish() {
    if (!draft) return;
    setPhase("saving");
    setErrorMessage(null);
    try {
      await saveCurationSettings(childId, draft);
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

  const regulationLabels = regulationOptions
    .filter((goal) => (draft.regulation_goals ?? []).includes(goal.key))
    .map((goal) => goal.label);

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
          summary={summarizeList(draft.interests ?? [])}
          expanded={expandedRow === "interests"}
          onToggle={() => setExpandedRow(expandedRow === "interests" ? null : "interests")}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {interestOptions.map((interest) => (
              <Pill
                key={interest}
                selected={(draft.interests ?? []).includes(interest)}
                onClick={() => toggleListField("interests", interest)}
              >
                {interest}
              </Pill>
            ))}
          </div>
        </HubRow>

        <HubRow
          title="Content mix"
          summary={
            draft.content_mix === "SURPRISE"
              ? "Surprise us — a good age-appropriate mix"
              : (draft.preferred_categories ?? []).length === 0
                ? "Let me choose categories — none chosen yet"
                : `Categories: ${summarizeList(draft.preferred_categories ?? [])}`
          }
          expanded={expandedRow === "contentMix"}
          onToggle={() => setExpandedRow(expandedRow === "contentMix" ? null : "contentMix")}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="radio" checked={draft.content_mix === "SURPRISE"} onChange={() => patchDraft({ content_mix: "SURPRISE" })} />
            Surprise us — a good age-appropriate mix
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="radio" checked={draft.content_mix === "CHOSEN"} onChange={() => patchDraft({ content_mix: "CHOSEN" })} />
            Let me choose categories
          </label>
          {draft.content_mix === "CHOSEN" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginLeft: 24 }}>
              {categoryOptions.map((category) => (
                <Pill
                  key={category}
                  selected={(draft.preferred_categories ?? []).includes(category)}
                  onClick={() => toggleListField("preferred_categories", category)}
                >
                  {category}
                </Pill>
              ))}
            </div>
          )}
        </HubRow>

        <HubRow
          title="Regulation goal"
          summary={regulationLabels.length === 0 ? "No restriction — any goal can be included" : summarizeList(regulationLabels)}
          expanded={expandedRow === "regulation"}
          onToggle={() => setExpandedRow(expandedRow === "regulation" ? null : "regulation")}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {regulationOptions.map((goal) => (
              <Pill key={goal.key} selected={(draft.regulation_goals ?? []).includes(goal.key)} onClick={() => toggleRegulationGoal(goal.key)}>
                {goal.label}
              </Pill>
            ))}
          </div>
        </HubRow>

        <HubRow
          title="Screen time & breaks"
          summary={`${draft.session_minutes ?? 30} min · every ${draft.break_interval_minutes ?? 15} min · ${BREAK_TYPES.find((t) => t.value === draft.break_type)?.label ?? draft.break_type ?? "—"}`}
          expanded={expandedRow === "screenTime"}
          onToggle={() => setExpandedRow(expandedRow === "screenTime" ? null : "screenTime")}
        >
          <div>
            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 6 }}>Duration</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DURATION_OPTIONS.map((minutes) => (
                <Pill key={minutes} selected={draft.session_minutes === minutes} onClick={() => patchDraft({ session_minutes: minutes })}>
                  {minutes} min
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 6 }}>Break every</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BREAK_INTERVAL_OPTIONS.map((minutes) => (
                <Pill key={minutes} selected={draft.break_interval_minutes === minutes} onClick={() => patchDraft({ break_interval_minutes: minutes })}>
                  {minutes} min
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "var(--kq-text-caption)", color: "var(--kq-text-secondary)", marginBottom: 6 }}>Break type</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BREAK_TYPES.map((type) => (
                <Pill key={type.value} selected={draft.break_type === type.value} onClick={() => patchDraft({ break_type: type.value })}>
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
