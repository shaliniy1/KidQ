"use client";

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

const sum = (weights: Weights) => Math.round(Object.values(weights).reduce((total, value) => total + value, 0) * 1000) / 1000;

function WeightInputs({ weights, onChange }: { weights: Weights; onChange: (next: Weights) => void }) {
  return (
    <div className="grid">
      {Object.entries(weights).map(([key, value]) => (
        <label key={key}>
          {key.replace(/_/g, " ").toLowerCase()}
          <input type="number" step={0.05} min={0} max={1} value={value} onChange={(event) => onChange({ ...weights, [key]: Number(event.target.value) })} />
        </label>
      ))}
    </div>
  );
}

export default function ConfigurationPage() {
  const taxonomy = useTaxonomy();
  const [scoring, setScoring] = useState<ScoringConfig | null>(null);
  const [ranking, setRanking] = useState<RankingConfig | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState({ kind: "category", key: "", label: "" });
  const [previewAge, setPreviewAge] = useState(4);
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
    run("Score weights saved as a new version; everything is being rescored.", async () => {
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
    run("Ranking weights saved as a new version.", async () => {
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
    void run(`Added "${term.label}". Reload to see it in pickers.`, async () => {
      unwrap(await api.POST("/taxonomy", { body: { kind: term.kind as never, key: term.key, label: term.label } }));
      setTerm({ ...term, key: "", label: "" });
    });
  };

  const runPreview = (event: FormEvent) => {
    event.preventDefault();
    void run("Preview updated.", async () => {
      setPreview(unwrap(await api.POST("/recommendations/preview", { body: { age_years: previewAge, interests: previewInterests, limit: 10 } as never })) as unknown as Preview);
    });
  };

  return (
    <div className="stack">
      <h1>Configuration</h1>
      {message && <p className="muted">✓ {message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="two-col">
        <div className="card stack">
          <h2 style={{ margin: 0 }}>KidQ score weights {scoring && <span className="badge">{scoring.version}</span>}</h2>
          {scoring && (
            <>
              <WeightInputs weights={scoring.weights} onChange={(weights) => setScoring({ ...scoring, weights })} />
              <p className={sum(scoring.weights) === 1 ? "muted" : "error"}>Total {sum(scoring.weights)} (must be 1)</p>
              <h3>How much each reviewer is trusted (confidence)</h3>
              <WeightInputs weights={scoring.sourceReliability} onChange={(sourceReliability) => setScoring({ ...scoring, sourceReliability })} />
              <label>
                Minimum AI self-confidence before an item needs attention
                <input type="number" step={0.05} min={0} max={1} value={scoring.minAiConfidence} onChange={(event) => setScoring({ ...scoring, minAiConfidence: Number(event.target.value) })} />
              </label>
              <button className="btn primary" disabled={sum(scoring.weights) !== 1} onClick={() => void saveScoring()}>
                Save as new version
              </button>
            </>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Recommendation ranking {ranking && <span className="badge">{ranking.version}</span>}</h2>
          {ranking && (
            <>
              <WeightInputs weights={ranking.weights} onChange={(weights) => setRanking({ ...ranking, weights })} />
              <p className={sum(ranking.weights) === 1 ? "muted" : "error"}>Total {sum(ranking.weights)} (must be 1)</p>
              <p className="muted" style={{ margin: 0 }}>
                At most {ranking.params.maxPerCreatorInTop} items per creator in the top {ranking.params.topWindow}; dismissed items return after{" "}
                {ranking.params.dismissCooldownDays} days. Popularity is never used.
              </p>
              <button className="btn primary" disabled={sum(ranking.weights) !== 1} onClick={() => void saveRanking()}>
                Save as new version
              </button>
            </>
          )}
        </div>
      </div>

      <div className="two-col">
        <form className="card stack" onSubmit={addTerm}>
          <h2 style={{ margin: 0 }}>Add a category, interest or goal</h2>
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
            Label
            <input
              value={term.label}
              onChange={(event) => setTerm({ ...term, label: event.target.value, key: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") })}
              placeholder="Creativity"
            />
          </label>
          <p className="muted" style={{ margin: 0 }}>Key: {term.key || "—"}</p>
          <button className="btn primary" disabled={term.key.length < 2 || !term.label}>
            Add
          </button>
        </form>

        <form className="card stack" onSubmit={runPreview}>
          <h2 style={{ margin: 0 }}>What would a child see?</h2>
          <label>
            Age: {previewAge}
            <input type="range" min={0} max={6} step={0.5} value={previewAge} onChange={(event) => setPreviewAge(Number(event.target.value))} />
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
          <button className="btn primary">Preview</button>
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
      </div>
    </div>
  );
}
