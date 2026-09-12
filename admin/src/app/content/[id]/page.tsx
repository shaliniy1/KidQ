"use client";

import { KidQPlayer, KidQStoryReader, parseTimestamp, type KidQPlayerHandle } from "@kidq/player";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiFailure, BLOCKER_LABELS, api, blockersOf, friendlyError, simpleStatus, unwrap, type AdminContent } from "@/lib/api";
import { ageRange, labelFor, useTaxonomy, type Taxonomy } from "@/lib/useTaxonomy";

type Criterion = { result: "PASS" | "FAIL" | "UNKNOWN"; evidence: string };
interface Detail {
  content: AdminContent;
  record: Record<string, unknown> & { filter_out: Record<string, Criterion>; filter_in: Record<string, Criterion>; source_url: string };
  assessments: Array<{ id: string; assessor_type: string; assessor_name: string; model_name: string | null; summary: string; result: string; created_at: string }>;
  decisions: Array<{ decision: string; reason: string; decided_by: string; decision_source: string; overrode_critical_flag: boolean; decided_at: string }>;
  revisions: Array<{ changes: Record<string, unknown>; edited_by: string; created_at: string }>;
  expert_reviews: Array<{ id: string; reviewer_name: string; reviewer_type: string; recommendation: string; source_url: string; verified: boolean }>;
  rights: Record<string, unknown>;
  transcript_status: string | null;
  story: { pages: Array<{ page: number; text: string; image_url: string | null; image_small_url: string | null }>; credits: string | null } | null;
}

const COMPONENTS = ["CONTENT_LANGUAGE", "PACING", "VISUAL_COMFORT", "AUDIO_COMFORT"] as const;
// Picture books have no soundtrack, so they are scored on three components.
const STORY_COMPONENTS = ["CONTENT_LANGUAGE", "PACING", "VISUAL_COMFORT"] as const;
const CRITICAL = new Set(["physical_violence", "verbal_or_emotional_aggression", "frightening_imagery", "mature_themes", "discrimination_or_stereotypes", "dangerous_behaviour"]);

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const taxonomy = useTaxonomy();
  const player = useRef<KidQPlayerHandle>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(unwrap(await api.GET("/content-items/{id}", { params: { path: { id } } })) as unknown as Detail);
    } catch (failure) {
      setError(friendlyError(failure, "This content could not be loaded. Please try again."));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs an admin action, then shows the refreshed detail the API returns. */
  const act = async (label: string, run: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    try {
      const result = await run();
      if (result && typeof result === "object" && "content" in result) setDetail(result as Detail);
      else await load();
      setNotice(label);
    } catch (failure) {
      const blockers = blockersOf(failure).map((b) => BLOCKER_LABELS[b] ?? b);
      setError(`${friendlyError(failure, "That change could not be saved. Please try again.")}${blockers.length ? ` ${blockers.join(", ")}.` : ""}`);
      throw failure;
    }
  };

  if (error && !detail) return <p className="error">{error}</p>;
  if (!detail) return <p className="muted">Loading…</p>;
  const { content } = detail;
  const status = simpleStatus(content);
  const seek = (timestamp: string) => player.current?.seekTo(parseTimestamp(timestamp));

  return (
    <div className="stack">
      <div className="detail-topline">
        <Link href="/content">← Content</Link>
        <span className={`status status-${status.key}`}>{status.label}</span>
        {content.parent_requests > 0 && <span className="badge warn">{content.parent_requests} parent request(s)</span>}
      </div>
      <h1 style={{ marginBottom: 0 }}>{content.title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {content.creator ?? "Unknown creator"} · {content.content_type === "STORYBOOK" ? "Storybook" : "Video"} · <a href={detail.record.source_url} target="_blank" rel="noreferrer">View original</a>
      </p>
      {notice && <p className="muted">✓ {notice}</p>}
      {error && <p className="error">{error}</p>}

      <div className="two-col">
        <div className="stack">
          <div className="content-preview">
            {content.content_type === "STORYBOOK" && detail.story ? (
              <KidQStoryReader title={content.title} pages={detail.story.pages} credits={detail.story.credits} attribution={content.attribution} />
            ) : (
              <KidQPlayer
                ref={player}
                player={content.player}
                title={content.title}
                poster={content.thumbnail_url}
                attribution={content.attribution}
                onError={(code) => void api.POST("/content-items/{id}/playback-errors", { params: { path: { id } }, body: { code } })}
              />
            )}
          </div>
        </div>

        <div className="stack">
          <Publish content={content} act={act} id={id} />
          <Tags content={content} taxonomy={taxonomy} act={act} id={id} />
          <TextEdit content={content} act={act} id={id} />
        </div>
      </div>

      <details className="advanced-review">
        <summary>Additional review checks</summary>
        <p className="muted">Open this only when you need to inspect or adjust scoring and safety checks.</p>
        <div className="two-col">
          <div className="stack">
            <ScoreCard content={content} onSeek={seek} />
            <Sliders content={content} act={act} id={id} />
            <Rubric detail={detail} act={act} id={id} />
          </div>
          <div className="stack">
            <ParentPreview content={content} taxonomy={taxonomy} />
            <Experts detail={detail} act={act} id={id} />
            <History detail={detail} />
          </div>
        </div>
      </details>
    </div>
  );
}

type Act = (label: string, run: () => Promise<unknown>) => Promise<void>;

function Timestamps({ values, onSeek }: { values: string[]; onSeek: (value: string) => void }) {
  if (!values.length) return null;
  return (
    <span className="row" style={{ display: "inline-flex", gap: 6, marginLeft: 6 }}>
      {values.map((value) => (
        <button key={value} type="button" className="link-button" onClick={() => onSeek(value)}>
          {value}
        </button>
      ))}
    </span>
  );
}

function ScoreCard({ content, onSeek }: { content: AdminContent; onSeek: (value: string) => void }) {
  const score = content.content_score;
  if (!score) return <div className="card muted">Not scored yet.</div>;
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Content score</h2>
        <div>
          <span className="score">{score.score ?? (score.safety_flags.length ? "Withheld" : "Not scored")}</span>
          {score.score != null && <span className="muted"> / 100</span>}
        </div>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {score.reason} · {Math.round(score.confidence * 100)}% confidence · {score.evaluated_by} · {score.version}
      </p>
      {score.safety_flags.map((flag) => (
        <p key={flag.key} className="error" style={{ margin: 0 }}>
          ⚠ {flag.key.replace(/_/g, " ")}: {flag.evidence}
          <Timestamps values={flag.timestamps} onSeek={onSeek} />
        </p>
      ))}
      {score.breakdown.map((part) => (
        <div key={part.key}>
          <div className="slider-row">
            <strong>{part.label}</strong>
            <div className="bar">
              <i style={{ width: `${part.score ?? 0}%` }} />
            </div>
            <span>{part.score ?? "—"}</span>
          </div>
          <p className="evidence">
            {part.source ? <span className="badge">{part.source}</span> : null} {part.evidence ?? "Not measured."} · weight {Math.round(part.weight * 100)}%
            <Timestamps values={part.timestamps} onSeek={onSeek} />
          </p>
        </div>
      ))}
    </div>
  );
}

function Sliders({ content, act, id }: { content: AdminContent; act: Act; id: string }) {
  const story = content.content_type === "STORYBOOK";
  const keys: readonly string[] = story ? STORY_COMPONENTS : COMPONENTS;
  const fallbackLabel: Record<string, string> = {
    CONTENT_LANGUAGE: "Content & language",
    PACING: story ? "Reading pace" : "Pacing",
    VISUAL_COMFORT: story ? "Illustrations" : "Visual comfort",
    AUDIO_COMFORT: "Audio comfort",
  };
  const initial = Object.fromEntries(keys.map((key) => [key, content.content_score?.breakdown.find((p) => p.key === key)?.score ?? 50])) as Record<string, number>;
  const [values, setValues] = useState(initial);
  const [note, setNote] = useState(story ? "Checked by reading the story." : "Checked by watching the video.");
  const changed = keys.filter((key) => values[key] !== initial[key] || initial[key] === null);
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Your scores (0–100)</h2>
      <p className="muted" style={{ margin: 0 }}>
        Pre-filled from the AI. Your changes are saved as an admin review and override the AI.
      </p>
      {keys.map((key) => (
        <label key={key} className="slider-row" style={{ fontWeight: 600 }}>
          {content.content_score?.breakdown.find((p) => p.key === key)?.label ?? fallbackLabel[key]}
          <input type="range" min={0} max={100} value={values[key]} onChange={(event) => setValues({ ...values, [key]: Number(event.target.value) })} />
          <span>{values[key]}</span>
        </label>
      ))}
      <input aria-label="What you observed" value={note} onChange={(event) => setNote(event.target.value)} />
      <button
        className="btn primary"
        disabled={changed.length === 0 || note.trim().length < 3}
        onClick={() =>
          void act("Scores saved", async () =>
            unwrap(
              await api.POST("/content-items/{id}/assessments", {
                params: { path: { id } },
                body: { scores: Object.fromEntries(changed.map((key) => [key, { value: values[key], evidence: note }])), criteria: [] },
              }),
            ),
          ).catch(() => undefined)
        }
      >
        Save {changed.length || ""} score change(s)
      </button>
    </div>
  );
}

function Rubric({ detail, act, id }: { detail: Detail; act: Act; id: string }) {
  const all = { ...detail.record.filter_out, ...detail.record.filter_in };
  const [edits, setEdits] = useState<Record<string, Criterion["result"]>>({});
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);
  const keys = Object.keys(all).filter((key) => showAll || all[key].result === "FAIL" || CRITICAL.has(key));
  const changed = Object.entries(edits).filter(([key, result]) => all[key]?.result !== result);
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>What the score is based on</h2>
        <button type="button" className="link-button" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show safety + fails only" : `Show all ${Object.keys(all).length} criteria`}
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <tbody>
            {keys.map((key) => (
              <tr key={key}>
                <td style={{ width: "35%" }}>
                  {CRITICAL.has(key) ? "⚠ " : ""}
                  {key.replace(/_/g, " ")}
                </td>
                <td style={{ width: 120 }}>
                  <select aria-label={key} value={edits[key] ?? all[key].result} onChange={(event) => setEdits({ ...edits, [key]: event.target.value as Criterion["result"] })}>
                    <option>PASS</option>
                    <option>FAIL</option>
                    <option>UNKNOWN</option>
                  </select>
                </td>
                <td className="muted">{all[key].evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {changed.length > 0 && (
        <div className="row">
          <input aria-label="Why you changed these" placeholder="Why (required)" value={note} onChange={(event) => setNote(event.target.value)} style={{ flex: 1 }} />
          <button
            className="btn primary"
            disabled={note.trim().length < 3}
            onClick={() =>
              void act("Rubric updated", async () =>
                unwrap(
                  await api.POST("/content-items/{id}/assessments", {
                    params: { path: { id } },
                    body: { scores: {}, criteria: changed.map(([key, result]) => ({ key, result, evidence: note })) as never },
                  }),
                ),
              )
                .then(() => setEdits({}))
                .catch(() => undefined)
            }
          >
            Save {changed.length} change(s)
          </button>
        </div>
      )}
    </div>
  );
}

function Publish({ content, act, id }: { content: AdminContent; act: Act; id: string }) {
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [needsOverride, setNeedsOverride] = useState(false);
  const decide = (decision: "APPROVED" | "REJECTED" | "MANUAL_REVIEW_REQUIRED", label: string) =>
    act(label, async () =>
      unwrap(
        await api.POST("/content-items/{id}/publication-decisions", {
          params: { path: { id } },
          body: { decision, reason, override_critical_flag: decision === "APPROVED" && override },
        }),
      ),
    )
      .then(() => {
        setReason("");
        setOverride(false);
        setNeedsOverride(false);
      })
      .catch((failure) => setNeedsOverride(failure instanceof ApiFailure && failure.code === "CRITICAL_FLAG"));

  const approved = content.current_status === "APPROVED";
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Review decision</h2>
      <p style={{ margin: 0 }}>
        {approved ? "Published — families can see this." : content.current_status === "REJECTED" ? "Marked as needing changes." : "Not visible to families yet."}
      </p>
      {content.publish_blockers.length > 0 && (
        <div className="chips">
          {content.publish_blockers.map((blocker) => (
            <span key={blocker} className="chip">
              {BLOCKER_LABELS[blocker] ?? blocker}
            </span>
          ))}
        </div>
      )}
      <textarea aria-label="Reason" placeholder="Reason (saved with the decision)" value={reason} onChange={(event) => setReason(event.target.value)} />
      {(needsOverride || content.has_critical_flag) && !approved && (
        <label className="row" style={{ fontWeight: 500 }}>
          <input type="checkbox" checked={override} onChange={(event) => setOverride(event.target.checked)} />
          Override the safety flag (explain why above, at least 15 characters)
        </label>
      )}
      <div className="row">
        {!approved && (
          <button className="btn good" disabled={reason.trim().length < 3} onClick={() => void decide("APPROVED", "Published")}>
            Publish
          </button>
        )}
        {approved && (
          <button className="btn" disabled={reason.trim().length < 3} onClick={() => void decide("MANUAL_REVIEW_REQUIRED", "Unpublished")}>
            Unpublish
          </button>
        )}
        {content.current_status !== "REJECTED" && (
          <button className="btn" disabled={reason.trim().length < 3} onClick={() => void decide("REJECTED", "Rejected")}>
            Needs changes
          </button>
        )}
      </div>
    </div>
  );
}

function MultiPick({ terms, value, onChange }: { terms: Array<{ key: string; label: string }>; value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="chips">
      {terms.map((term) => {
        const on = value.includes(term.key);
        return (
          <button key={term.key} type="button" className="chip" aria-pressed={on} style={on ? { background: "var(--sage-tint)", fontWeight: 700 } : undefined} onClick={() => onChange(on ? value.filter((v) => v !== term.key) : [...value, term.key])}>
            {term.label}
          </button>
        );
      })}
    </div>
  );
}

function Tags({ content, taxonomy, act, id }: { content: AdminContent; taxonomy: Taxonomy | null; act: Act; id: string }) {
  const [ageMin, setAgeMin] = useState(content.age.min);
  const [ageMax, setAgeMax] = useState(content.age.max);
  const [category, setCategory] = useState(content.category ?? "");
  const [interests, setInterests] = useState(content.interests);
  const [development, setDevelopment] = useState(content.development_goals);
  const [regulation, setRegulation] = useState(content.regulation_goals);
  const [language, setLanguage] = useState(content.language ?? "");
  const [contentType, setContentType] = useState(content.content_type);
  if (!taxonomy) return null;
  const groupKey = taxonomy.age_group.find((term) => term.meta.min === ageMin && term.meta.max === ageMax)?.key ?? "";
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Content details</h2>
      <label>
        Content type
        <select value={contentType} onChange={(event) => setContentType(event.target.value as typeof contentType)}>
          <option value="VIDEO">Video</option>
          <option value="STORYBOOK">Storybook</option>
          <option value="ACTIVITY">Activity</option>
          <option value="INTERACTIVE_CONTENT">Interactive content</option>
        </select>
      </label>
      <label>
        Age group
        <select
          value={groupKey}
          onChange={(event) => {
            const range = ageRange(taxonomy, event.target.value);
            if (range) [setAgeMin, setAgeMax].forEach((set, index) => set(range[index]));
          }}
        >
          <option value="">Custom ({ageMin ?? "?"}–{ageMax ?? "?"})</option>
          {taxonomy.age_group.map((term) => (
            <option key={term.key} value={term.key}>
              {term.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Category
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Choose…</option>
          {taxonomy.category.map((term) => (
            <option key={term.key} value={term.key}>
              {term.label}
            </option>
          ))}
        </select>
      </label>
      <details className="metadata-details">
        <summary>Interests and learning goals</summary>
        <div><h3>Interests</h3><MultiPick terms={taxonomy.interest} value={interests} onChange={setInterests} /></div>
        <div><h3>Development goals</h3><MultiPick terms={taxonomy.development_goal} value={development} onChange={setDevelopment} /></div>
        <div><h3>Regulation goals</h3><MultiPick terms={taxonomy.regulation_goal} value={regulation} onChange={setRegulation} /></div>
      </details>
      <label>
        Language
        <input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en" />
      </label>
      <button
        className="btn primary"
        onClick={() =>
          void act("Tags saved", async () =>
            unwrap(
              await api.PATCH("/content-items/{id}/classification", {
                params: { path: { id } },
                body: {
                  age_min: ageMin,
                  age_max: ageMax,
                  category: category || null,
                  interests,
                  development_goals: development,
                  regulation_goals: regulation,
                  language: language || null,
                  content_type: contentType,
                },
              }),
            ),
          ).catch(() => undefined)
        }
      >
        Save details
      </button>
    </div>
  );
}

function TextEdit({ content, act, id }: { content: AdminContent; act: Act; id: string }) {
  const [title, setTitle] = useState(content.title);
  const [summary, setSummary] = useState(content.kidq_summary ?? "");
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Title and summary</h2>
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
      </label>
      <label>
        Summary (two sentences)
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={400} />
      </label>
      <button
        className="btn"
        disabled={title.trim().length === 0 || (title === content.title && summary === (content.kidq_summary ?? ""))}
        onClick={() =>
          void act("Text saved", async () => unwrap(await api.PATCH("/content-items/{id}", { params: { path: { id } }, body: { title, kidq_summary: summary || null } }))).catch(
            () => undefined,
          )
        }
      >
        Save text
      </button>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        The source&apos;s own title and description are kept unchanged for provenance.
      </p>
    </div>
  );
}

function ParentPreview({ content, taxonomy }: { content: AdminContent; taxonomy: Taxonomy | null }) {
  const score = content.content_score;
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Parent card preview</h2>
      <div style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>{content.title}</strong>
          <span className="score">{score?.score ?? "—"}</span>
        </div>
        <p className="muted" style={{ margin: "6px 0" }}>{content.kidq_summary ?? "No summary yet."}</p>
        <div className="chips">
          {content.age.groups.map((group) => (
            <span key={group} className="chip">
              Age {group.replace("_", "–")}
            </span>
          ))}
          {content.category && <span className="chip">{labelFor(taxonomy, "category", content.category)}</span>}
          {content.development_goals.slice(0, 2).map((goal) => (
            <span key={goal} className="chip">
              {labelFor(taxonomy, "development_goal", goal)}
            </span>
          ))}
        </div>
        {score?.breakdown.map((part) => (
          <div key={part.key} className="slider-row" style={{ marginTop: 6 }}>
            <span className="muted">{part.label}</span>
            <div className="bar">
              <i style={{ width: `${part.score ?? 0}%` }} />
            </div>
            <span>{part.score ?? "—"}</span>
          </div>
        ))}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary small" disabled>
            Add to library
          </button>
          <button className="btn small" disabled>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function Experts({ detail, act, id }: { detail: Detail; act: Act; id: string }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Early-years educator");
  const [recommendation, setRecommendation] = useState<"RECOMMEND" | "NOT_RECOMMEND">("RECOMMEND");
  const [source, setSource] = useState("");
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Expert reviews</h2>
      {detail.expert_reviews.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>None yet.</p>
      ) : (
        <ul style={{ margin: 0 }}>
          {detail.expert_reviews.map((review) => (
            <li key={review.id}>
              {review.reviewer_name} ({review.reviewer_type}): {review.recommendation === "RECOMMEND" ? "recommends" : "does not recommend"} ·{" "}
              {review.verified ? "verified" : "per public sources"} ·{" "}
              <a href={review.source_url} target="_blank" rel="noreferrer">
                source
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <input aria-label="Reviewer name" placeholder="Reviewer name" value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label="Reviewer type" value={type} onChange={(event) => setType(event.target.value)} />
        <select aria-label="Recommendation" value={recommendation} onChange={(event) => setRecommendation(event.target.value as typeof recommendation)}>
          <option value="RECOMMEND">Recommends</option>
          <option value="NOT_RECOMMEND">Does not recommend</option>
        </select>
        <input aria-label="Source URL" placeholder="https://… (where they said it)" value={source} onChange={(event) => setSource(event.target.value)} />
        <button
          className="btn small"
          disabled={!name || !source.startsWith("http")}
          onClick={() =>
            void act("Expert review added", async () =>
              unwrap(
                await api.POST("/content-items/{id}/expert-reviews", {
                  params: { path: { id } },
                  body: { reviewer_name: name, reviewer_type: type, recommendation, source_url: source, verified: false },
                }),
              ),
            )
              .then(() => {
                setName("");
                setSource("");
              })
              .catch(() => undefined)
          }
        >
          Add
        </button>
      </div>
    </div>
  );
}

function History({ detail }: { detail: Detail }) {
  const events = [
    ...detail.decisions.map((d) => ({ at: d.decided_at, text: `${d.decision}${d.overrode_critical_flag ? " (safety override)" : ""} by ${d.decided_by}: ${d.reason}` })),
    ...detail.revisions.map((r) => ({ at: r.created_at, text: `Edited ${Object.keys(r.changes).join(", ")} by ${r.edited_by}` })),
    ...detail.assessments.map((a) => ({ at: a.created_at, text: `${a.assessor_type === "MODEL" ? "AI" : a.assessor_type === "HUMAN" ? "Admin" : "Rules"} (${a.model_name ?? a.assessor_name}): ${a.summary}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>History</h2>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {events.map((event, index) => (
          <li key={index}>
            <span className="muted">{new Date(event.at).toLocaleString()}</span> — {event.text}
          </li>
        ))}
      </ul>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        License: {String(detail.rights.license_name ?? "unknown")} · Transcript: {detail.transcript_status ?? "—"}
      </p>
    </div>
  );
}
