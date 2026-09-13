"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api, unwrap } from "@/lib/api";
import { useTaxonomy } from "@/lib/useTaxonomy";

type Weights = Record<string, number>;
interface ScoringConfig {
  version: string;
  weights: Weights;
  sourceReliability: Weights;
  minAiConfidence: number;
}
interface RankingConfig {
  version: string;
  weights: Weights;
  params: {
    relevanceWeights: { interests: number; developmentGoals: number; regulationGoals: number; category: number };
    maxPerCreatorInTop: number;
    topWindow: number;
    dismissCooldownDays: number;
    expertNeutral: number;
  };
}
interface Preview {
  items: Array<{ rank: number; cold_start: boolean; why: string[]; card: { id: string; title: string; content_score: { score: number | null } | null } }>;
}

// Plain-language names for every weight, so admins see what each number does.
const SCORE_PARTS: Record<string, [string, string]> = {
  CONTENT_LANGUAGE: ["Content & language", "Safe, suitable themes, words and behaviour"],
  PACING: ["Pacing", "Calm, slow scenes with few quick cuts"],
  VISUAL_COMFORT: ["Visual comfort", "Soft, light colours; no flashing or clutter"],
  AUDIO_COMFORT: ["Audio comfort", "Gentle, even sound; no sudden loud noises"],
};
const TRUST: Record<string, [string, string]> = {
  HUMAN: ["Your ratings", "Admins and experts"],
  MODEL: ["AI ratings", "The Gemini scoring agent"],
  RULE: ["Rule checks", "Title and description checks"],
};
const RANK_PARTS: Record<string, [string, string]> = {
  relevance: ["Matches the child", "Interests, goals and chosen categories"],
  score: ["KidQ score", "Better-scored items first"],
  learning: ["Learning value", "What the child can learn or do"],
  expert: ["Expert reviews", "Items experts recommend"],
  preference: ["Fits the child", "Made for their age and short enough for one session"],
};

const percent = (value: number) => Math.round(value * 100);
const total = (weights: Weights) => Object.values(weights).reduce((sum, value) => sum + percent(value), 0);

function PercentRows({ weights, names, onChange }: { weights: Weights; names: Record<string, [string, string]>; onChange: (next: Weights) => void }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {Object.entries(weights).map(([key, value]) => (
        <label key={key} className="slider-row" style={{ gridTemplateColumns: "minmax(0, 1fr) 90px", fontWeight: 600 }}>
          <span>
            {names[key]?.[0] ?? key}
            <span className="muted" style={{ display: "block", fontWeight: 400, fontSize: 13 }}>
              {names[key]?.[1]}
            </span>
          </span>
          <span className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
            <input type="number" min={0} max={100} step={5} value={percent(value)} onChange={(event) => onChange({ ...weights, [key]: Number(event.target.value) / 100 })} style={{ width: 64 }} />%
          </span>
        </label>
      ))}
    </div>
  );
}

function TotalLine({ weights }: { weights: Weights }) {
  const sum = total(weights);
  return <p className={sum === 100 ? "muted" : "error"}>{sum === 100 ? "Adds up to 100% ✓" : `Adds up to ${sum}% — make it 100% to save.`}</p>;
}

export default function SettingsPage() {
  const taxonomy = useTaxonomy();
  const [scoring, setScoring] = useState<ScoringConfig | null>(null);
  const [ranking, setRanking] = useState<RankingConfig | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState({ kind: "category", key: "", label: "" });
  const [previewBand, setPreviewBand] = useState("3_4");
  const [previewInterests, setPreviewInterests] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    api.GET("/config/scoring").then((result) => setScoring(unwrap(result) as ScoringConfig)).catch((failure: Error) => setError(failure.message));
    api.GET("/config/ranking").then((result) => setRanking(unwrap(result) as unknown as RankingConfig)).catch((failure: Error) => setError(failure.message));
  }, []);

  const run = async (label: string, work: () => Promise<void>) => {
    setError(null);
    setMessage(null);
    try {
      await work();
      setMessage(label);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Save failed.");
    }
  };

  const saveScoring = () =>
    scoring &&
    run("Saved. Every item's score is being recalculated with the new weights.", async () => {
      const saved = unwrap(
        await api.PUT("/config/scoring", {
          body: {
            weights: scoring.weights as never,
            source_reliability: scoring.sourceReliability as never,
            min_ai_confidence: scoring.minAiConfidence,
          },
        }),
      );
      setScoring(saved as ScoringConfig);
    });

  const saveRanking = () =>
    ranking &&
    run("Saved. Recommendations use the new order from now on.", async () => {
      const p = ranking.params;
      const saved = unwrap(
        await api.PUT("/config/ranking", {
          body: {
            weights: ranking.weights as never,
            relevance_weights: {
              interests: p.relevanceWeights.interests,
              development_goals: p.relevanceWeights.developmentGoals,
              regulation_goals: p.relevanceWeights.regulationGoals,
              category: p.relevanceWeights.category,
            },
            max_per_creator_in_top: p.maxPerCreatorInTop,
            top_window: p.topWindow,
            dismiss_cooldown_days: p.dismissCooldownDays,
            expert_neutral: p.expertNeutral,
          },
        }),
      );
      setRanking(saved as unknown as RankingConfig);
    });

  const addTerm = (event: FormEvent) => {
    event.preventDefault();
    void run(`Added “${term.label}”. Reload to see it in the pickers.`, async () => {
      unwrap(await api.POST("/taxonomy", { body: { kind: term.kind as never, key: term.key, label: term.label } }));
      setTerm({ ...term, key: "", label: "" });
    });
  };

  const runPreview = (event: FormEvent) => {
    event.preventDefault();
    void run("Preview updated.", async () => {
      setPreview(unwrap(await api.POST("/recommendations/preview", { body: { age_band: previewBand, interests: previewInterests, limit: 10 } as never })) as unknown as Preview);
    });
  };

  return (
    <div className="stack">
      <h1>Configuration</h1>
      <div className="card stack" style={{ gap: 6 }}>
        <p style={{ margin: 0 }}>
          These settings decide how KidQ works out each item&apos;s score and the order of each child&apos;s recommendations. The defaults are sensible, so you rarely need to
          change them.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Looking to publish? Use the <Link href="/review">Review queue</Link> or the <Link href="/content?state=READY_TO_APPROVE">Content library</Link>: tick the items (or
          “Select all ready to approve”), then press <strong>Publish selected</strong>.
        </p>
      </div>
      {message && <p className="muted">✓ {message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="two-col">
        <div className="card stack">
          <h2 style={{ margin: 0 }}>How the KidQ score is worked out</h2>
          <p className="muted" style={{ margin: 0 }}>
            Every item gets four ratings from 0 to 100, from the AI or from you. The score is their weighted average; these percentages are the weights.
          </p>
          {scoring && (
            <>
              <PercentRows weights={scoring.weights} names={SCORE_PARTS} onChange={(weights) => setScoring({ ...scoring, weights })} />
              <TotalLine weights={scoring.weights} />
              <details>
                <summary>Advanced: how much each kind of rating is trusted</summary>
                <div className="stack" style={{ marginTop: 10 }}>
                  <p className="muted" style={{ margin: 0 }}>
                    This sets the confidence shown next to a score. Your own ratings always override the AI&apos;s.
                  </p>
                  <PercentRows weights={scoring.sourceReliability} names={TRUST} onChange={(sourceReliability) => setScoring({ ...scoring, sourceReliability })} />
                  <label className="slider-row" style={{ gridTemplateColumns: "minmax(0, 1fr) 90px", fontWeight: 600 }}>
                    <span>
                      Ask me to check AI ratings below
                      <span className="muted" style={{ display: "block", fontWeight: 400, fontSize: 13 }}>
                        Items whose AI confidence is lower go to “Needs attention”
                      </span>
                    </span>
                    <span className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={percent(scoring.minAiConfidence)}
                        onChange={(event) => setScoring({ ...scoring, minAiConfidence: Number(event.target.value) / 100 })}
                        style={{ width: 64 }}
                      />
                      %
                    </span>
                  </label>
                </div>
              </details>
              <button className="btn primary" disabled={total(scoring.weights) !== 100} onClick={() => void saveScoring()}>
                Save and recalculate all scores
              </button>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Version {scoring.version}. Each save creates a new version, so earlier scores stay explainable.
              </p>
            </>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>How recommendations are ordered</h2>
          <p className="muted" style={{ margin: 0 }}>
            Only published items are ever recommended. Among those that fit the child&apos;s age and language, these percentages set what counts most. Popularity is never used.
          </p>
          {ranking && (
            <>
              <PercentRows weights={ranking.weights} names={RANK_PARTS} onChange={(weights) => setRanking({ ...ranking, weights })} />
              <TotalLine weights={ranking.weights} />
              <p className="muted" style={{ margin: 0 }}>
                At most {ranking.params.maxPerCreatorInTop} items from one creator appear in the top {ranking.params.topWindow}; items a parent skips come back after{" "}
                {ranking.params.dismissCooldownDays} days.
              </p>
              <button className="btn primary" disabled={total(ranking.weights) !== 100} onClick={() => void saveRanking()}>
                Save
              </button>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Version {ranking.version}.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="two-col">
        <form className="card stack" onSubmit={runPreview}>
          <h2 style={{ margin: 0 }}>What would a child see?</h2>
          <p className="muted" style={{ margin: 0 }}>
            Try an age and some interests to see the recommendations a parent would get right now.
          </p>
          <label>
            Age band
            <select value={previewBand} onChange={(event) => setPreviewBand(event.target.value)}>
              {taxonomy?.age_group.map((band) => (
                <option key={band.key} value={band.key}>
                  {band.label}
                </option>
              ))}
            </select>
          </label>
          <div className="chips">
            {taxonomy?.interest.map((interest) => {
              const on = previewInterests.includes(interest.key);
              return (
                <button
                  key={interest.key}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  style={on ? { background: "var(--sage-tint)", fontWeight: 700 } : undefined}
                  onClick={() => setPreviewInterests(on ? previewInterests.filter((key) => key !== interest.key) : [...previewInterests, interest.key])}
                >
                  {interest.label}
                </button>
              );
            })}
          </div>
          <button className="btn primary">Show recommendations</button>
          {preview &&
            (preview.items.length === 0 ? (
              <p className="muted">Nothing published fits this child yet.</p>
            ) : (
              <ol style={{ margin: 0 }}>
                {preview.items.map((item) => (
                  <li key={item.card.id}>
                    <strong>{item.card.title}</strong> · {item.card.content_score?.score ?? "—"} · <span className="muted">{item.why.join("; ")}</span>
                  </li>
                ))}
              </ol>
            ))}
        </form>

        <form className="card stack" onSubmit={addTerm}>
          <h2 style={{ margin: 0 }}>Add a word to the shared list</h2>
          <p className="muted" style={{ margin: 0 }}>
            Parents choose from these words in onboarding, and you tag content with the same ones. Add one only if it&apos;s missing.
          </p>
          <label>
            Type
            <select value={term.kind} onChange={(event) => setTerm({ ...term, kind: event.target.value })}>
              <option value="category">Category</option>
              <option value="interest">Interest</option>
              <option value="development_goal">Development goal</option>
              <option value="regulation_goal">Regulation goal</option>
              <option value="language">Language</option>
            </select>
          </label>
          <label>
            Name
            <input
              value={term.label}
              onChange={(event) => setTerm({ ...term, label: event.target.value, key: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") })}
              placeholder="e.g. Dinosaurs"
            />
          </label>
          <button className="btn primary" disabled={term.key.length < 2 || !term.label}>
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
