// AI scoring agent (plan: "AI scoring agent (Gemini)"). One structured Gemini call per video
// returns what it observed, every rubric criterion, the component scores with evidence and
// timestamps, and suggested tags — in that order, so scores follow the evidence. Our code — not
// the model — turns these into the KidQ score, bounds scores by what the model observed, and the
// model can never approve anything.
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "../config/env";
import { HttpError } from "../connectors/http";
import type { StoryContent } from "../connectors/types";
import type { Db } from "../db/pool";
import { MAX_CATEGORIES, type SuggestedClassification } from "../domain/analysis/rules";
import { CRITICAL_KEYS, RUBRIC, RUBRIC_VERSION } from "../domain/rubric";
import { COMPONENTS, componentsFor, type Component, type ComponentInput, type CriterionInput } from "../domain/scoring";
import {
  applyBounds,
  AUDIENCES,
  bookBounds,
  bookTextMetrics,
  LEVELS,
  LOUDNESS,
  MUSIC,
  observationBounds,
  PALETTES,
  SPEECH_PACES,
  TEXT_AMOUNTS,
} from "../domain/scoring/evidence";
import type { NewAssessment } from "../repositories/assessments";
import { keysOf, type Taxonomy } from "../repositories/taxonomy";
import { deleteMediaFile, GeminiQuotaError, generateJson, inlineImage, uploadMediaFile, type GeminiPart } from "./gemini";

export interface AgentTarget {
  contentItemId: string;
  sourceSystemId: string;
  externalId: string;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  /** Rights allow a temporary copy (NASA public domain, Wikimedia CC/PD). Never true for YouTube. */
  allowsMediaCopy: boolean;
  title: string;
  description: string | null;
  creator: string | null;
  durationSeconds: number | null;
  metadataHash: string;
  contentType: string;
  /** Picture books: the stored pages the AI reads, with each illustration fetched inline. */
  story: StoryContent | null;
}

export type AgentOutcome =
  | { kind: "SCORED"; assessment: NewAssessment; classification: SuggestedClassification }
  | { kind: "CACHED" }
  | { kind: "DISABLED" }
  | { kind: "UNAVAILABLE"; reason: string }
  | { kind: "INVALID_OUTPUT"; reason: string }
  | { kind: "DEFERRED"; retryAt: Date; reason: string };

/** Bump whenever the prompt or response schema changes: a new version re-scores items on request and never reuses the cache. */
export const PROMPT_VERSION = "2";

const PACIFIC = "America/Los_Angeles";
const ASSUMED_SECONDS = 600;
const MAX_FILE_SECONDS = 20 * 60;
const DAILY_QUOTA_REASON = "Every Gemini model's free daily limit is used up; AI scoring resumes after midnight Pacific.";
const OVERLOAD_WAIT_MS = 2 * 60_000;
// Gemini samples video at 1 frame a second by default, which misses fast cuts and flashes. Short
// uploaded files are sampled faster; YouTube URLs stay at the default until that's verified.
const SHARP_VIEW_MAX_SECONDS = 5 * 60;
const SHARP_VIEW_FPS = 3;

/** Gemini's free-tier daily limits reset at midnight Pacific time. */
export function pacificDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PACIFIC, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function nextPacificReset(now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: PACIFIC,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const [year, month, day] = [Number(parts.year), Number(parts.month) - 1, Number(parts.day)];
  const wallClockAsUtc = Date.UTC(year, month, day, Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offset = wallClockAsUtc - now.getTime();
  // 00:05 Pacific the next day, a little after the reset.
  return new Date(Date.UTC(year, month, day + 1, 0, 5, 0) - offset);
}

export function agentCacheKey(target: AgentTarget, model: string): string {
  return crypto.createHash("sha256").update([target.metadataHash, RUBRIC_VERSION, PROMPT_VERSION, model].join("|")).digest("hex");
}

const VIDEO_INTRO = [
  "You review videos for KidQ, a calm learning library for children aged 0–6.",
  "Watch the entire video, visuals and audio. Fill in the JSON in order: what you observed, then every rubric criterion, then the component scores, then the tags.",
  "Each evidence string is one factual sentence about what you observed, with mm:ss timestamps for the moments that drove it.",
];
const STORY_INTRO = [
  "You review picture books for KidQ, a calm learning library for children aged 0–6; parents read them aloud and early readers read them alone.",
  "Read every page and look at every illustration. Fill in the JSON in order: what you observed, then every rubric criterion, then the component scores, then the tags.",
  'Each evidence string is one factual sentence that names the pages it refers to (for example "p. 4"); leave timestamps empty.',
];
const KIDQ_STANDARD = [
  "KidQ's standard: slow, gentle pacing; soft, natural or pastel colours with steady light; calm, even sound; kind and safe behaviour.",
  "Bright, saturated or neon colours, harsh contrast, flashing, fast cuts, loud or jarring sound, and anything made for adults fall short of it.",
  "Score strictly. Most good children's content scores 70–85; 90 or more is rare and needs clear evidence.",
  "Never guess: use UNKNOWN for a criterion you could not judge, and lower self_confidence when unsure.",
];
const VIDEO_OBSERVATION_GUIDE = [
  "Observations — what you saw and heard, before judging anything:",
  "- cuts_per_minute: your estimate of scene cuts or hard transitions per minute.",
  "- motion: LOW (mostly still), MEDIUM, or HIGH (constant fast movement).",
  "- palette: SOFT_NATURAL (natural, pastel or muted), BRIGHT (saturated but balanced), or HARSH (neon, intensely saturated or strongly contrasting).",
  "- flashing_moments: mm:ss of any flashing, strobing or rapid light changes; empty if none.",
  "- loudness: SILENT, QUIET_EVEN, LIVELY (upbeat but steady) or LOUD_SPIKY (loud, or sudden peaks). sudden_loud_moments: their mm:ss.",
  "- speech_pace: NONE, SLOW, MODERATE or FAST. music: NONE, CALM, UPBEAT or INTENSE.",
  "- on_screen_text: NONE, SOME or HEAVY. clutter: LOW, MEDIUM or HIGH (competing objects and movement).",
  "- intended_audience: YOUNG_CHILDREN (made for ages 0–6), OLDER_CHILDREN, GENERAL (not made for children but harmless, such as nature footage) or ADULTS (news, briefings, trailers, adult topics).",
];
const STORY_OBSERVATION_GUIDE = [
  "Observations — what you saw, before judging anything:",
  "- palette: SOFT_NATURAL (natural, pastel or muted), BRIGHT (saturated but balanced), or HARSH (neon, intensely saturated or strongly contrasting illustrations).",
  "- clutter: LOW, MEDIUM or HIGH (busy pages).",
  "- intended_audience: YOUNG_CHILDREN (made for ages 0–6), OLDER_CHILDREN, GENERAL or ADULTS.",
];
const CRITERIA_GUIDE = [
  "Report every critical safety problem through its criterion: sexual or explicit content → mature_themes;",
  "graphic or strong violence → physical_violence; behaviour a child could copy and get hurt → dangerous_behaviour;",
  "severe abusive language or bullying → verbal_or_emotional_aggression; disturbing or highly frightening content → frightening_imagery;",
  "hateful stereotypes → discrimination_or_stereotypes.",
  "flashing_or_excessive_contrast FAILs for flashing or strobing, and also for a harsh palette — neon, intensely saturated or strongly contrasting colours — even without flashing.",
  "developmental_mismatch FAILs when the item was made for adults or older children, or is far outside ages 0–6.",
];
const VIDEO_COMPONENT_GUIDE = [
  "Score each component 0–100 (higher is better for a young child) using these bands:",
  "- CONTENT_LANGUAGE (suitability only, not educational value): 90–100 wholly suitable, kind and positive; 75–89 suitable with minor issues (mild peril that resolves, a few advanced words); 60–74 some concerns (rude words, scary moments, mature references); below 60 unsuitable.",
  "- PACING: 90–100 about 6 cuts a minute or fewer, long calm shots; 75–89 about 7–12; 60–74 about 13–20 or bursts of fast motion; 40–59 about 21–30; below 40 frantic.",
  "- VISUAL_COMFORT: 90–100 soft, natural or pastel colours, steady light, uncluttered; 75–89 some bright colours but balanced; 60–74 a bright, saturated palette or busy scenes; below 60 neon or harsh contrast, flashing, or intense visuals.",
  "- AUDIO_COMFORT: 90–100 quiet and even, gentle voices; 75–89 upbeat but steady; 60–74 loud music or occasional sudden sounds; below 60 shouting, jarring effects or loud peaks.",
];
const STORY_COMPONENT_GUIDE = [
  "Score each component 0–100 (higher is better for a young child) using these bands:",
  "- CONTENT_LANGUAGE (suitability only, not educational value): 90–100 wholly suitable, kind and positive; 75–89 suitable with minor issues; 60–74 some concerns (rude words, scary moments, mature references); below 60 unsuitable.",
  "- PACING (reading pace): 90–100 a few short sentences a page with simple, repeated words; 75–89 short paragraphs a young child can follow; 60–74 long pages or advanced vocabulary for this age; below 60 too dense to follow.",
  "- VISUAL_COMFORT (illustrations): 90–100 soft, clear, uncluttered illustrations; 75–89 bright but balanced; 60–74 busy or saturated pages; below 60 harsh, neon or frightening images.",
];

export function buildPrompt(target: AgentTarget, taxonomy: Taxonomy): string {
  const story = target.contentType === "STORYBOOK";
  const criteria = RUBRIC.map((c) => `- ${c.key} [${c.group === "FILTER_OUT" ? "FAIL if present" : "PASS if present"}]: ${c.description}`);
  const categories = taxonomy.category
    .filter((term) => term.active && (story || term.key !== "storybooks"))
    .map((term) => `- ${term.key} (${term.label})${typeof term.meta?.definition === "string" ? `: ${term.meta.definition}` : ""}`);
  return [
    ...(story ? STORY_INTRO : VIDEO_INTRO),
    ...KIDQ_STANDARD,
    "",
    ...(story ? STORY_OBSERVATION_GUIDE : VIDEO_OBSERVATION_GUIDE),
    "",
    ...CRITERIA_GUIDE,
    story ? "Return a result for every rubric criterion (UNKNOWN for criteria about sound, motion or video editing):" : "Return a result for every rubric criterion:",
    ...criteria,
    "",
    ...(story ? STORY_COMPONENT_GUIDE : VIDEO_COMPONENT_GUIDE),
    "",
    "Suggest tags using only these keys.",
    story
      ? "category: storybooks (every picture book). also_fits: up to two more categories the book's topic fits; can be empty."
      : "category: the one category that fits best. also_fits: up to two more that also fit; can be empty. Storybooks is only for picture books, never for videos.",
    ...categories,
    `interests: ${keysOf(taxonomy, "interest").join(", ")}`,
    `development_goals: ${keysOf(taxonomy, "development_goal").join(", ")}`,
    `regulation_goals: ${keysOf(taxonomy, "regulation_goal").join(", ")}`,
    story ? "language: ISO 639-1 code of the story's language." : "language: ISO 639-1 code of the spoken language, or null if there is no speech.",
    "age_min / age_max: youngest and oldest suitable age between 0 and 6. KidQ's age bands are 0–2, 2–3, 3–4, 4–5 and 5–6.",
    "kidq_summary: at most two sentences for parents. learning_objective: one sentence, or null.",
    "",
    `Source metadata (may be incomplete; the ${story ? "book" : "video"} itself is the evidence):`,
    `title: ${target.title}`,
    `creator: ${target.creator ?? "unknown"}`,
    story ? `pages: ${target.story?.pages.length ?? 0}` : `duration_seconds: ${target.durationSeconds ?? "unknown"}`,
    `description: ${(target.description ?? "").slice(0, 500)}`,
  ].join("\n");
}

// Gemini writes properties in propertyOrdering order, so each object lists evidence before the verdict.
const object = (properties: Record<string, object>) => ({ type: "OBJECT", properties, required: Object.keys(properties), propertyOrdering: Object.keys(properties) });
const enumString = (values: readonly string[]) => ({ type: "STRING", enum: [...values] });

export function responseSchema(taxonomy: Taxonomy, components: readonly Component[], story = false) {
  const strings = (values?: string[]) => ({ type: "ARRAY", items: values?.length ? enumString(values) : { type: "STRING" } });
  const observations = story
    ? object({ palette: enumString(PALETTES), clutter: enumString(LEVELS), intended_audience: enumString(AUDIENCES) })
    : object({
        cuts_per_minute: { type: "NUMBER" },
        motion: enumString(LEVELS),
        palette: enumString(PALETTES),
        flashing_moments: strings(),
        loudness: enumString(LOUDNESS),
        sudden_loud_moments: strings(),
        speech_pace: enumString(SPEECH_PACES),
        music: enumString(MUSIC),
        on_screen_text: enumString(TEXT_AMOUNTS),
        clutter: enumString(LEVELS),
        intended_audience: enumString(AUDIENCES),
      });
  const component = object({ evidence: { type: "STRING" }, timestamps: strings(), score: { type: "INTEGER" }, self_confidence: { type: "NUMBER" } });
  const categories = keysOf(taxonomy, "category").filter((key) => story || key !== "storybooks");
  return object({
    observations,
    criteria: {
      type: "ARRAY",
      items: object({ key: enumString(RUBRIC.map((c) => c.key)), evidence: { type: "STRING" }, timestamps: strings(), result: enumString(["PASS", "FAIL", "UNKNOWN"]) }),
    },
    components: object(Object.fromEntries(components.map((c) => [c, component]))),
    classification: object({
      category: enumString(categories),
      also_fits: strings(categories),
      age_min: { type: "NUMBER" },
      age_max: { type: "NUMBER" },
      interests: strings(keysOf(taxonomy, "interest")),
      development_goals: strings(keysOf(taxonomy, "development_goal")),
      regulation_goals: strings(keysOf(taxonomy, "regulation_goal")),
      language: { type: "STRING", nullable: true },
    }),
    learning_objective: { type: "STRING", nullable: true },
    kidq_summary: { type: "STRING" },
  });
}

const TIMESTAMP = /^\d{1,2}:\d{2}(?::\d{2})?$/;
const timestamps = z
  .array(z.string())
  .default([])
  .transform((values) => values.map((value) => value.trim()).filter((value) => TIMESTAMP.test(value)).slice(0, 10));
const componentOutput = z.object({ score: z.number().min(0).max(100), evidence: z.string().min(1), timestamps, self_confidence: z.number().min(0).max(1) });
// Optional throughout: an output from before prompt v2 has no observations, and a missing field just means no bound.
const observationsOutput = z.object({
  cuts_per_minute: z.number().min(0).max(600).nullable().optional(),
  motion: z.enum(LEVELS).optional(),
  palette: z.enum(PALETTES).optional(),
  flashing_moments: timestamps.optional(),
  loudness: z.enum(LOUDNESS).optional(),
  sudden_loud_moments: timestamps.optional(),
  speech_pace: z.enum(SPEECH_PACES).optional(),
  music: z.enum(MUSIC).optional(),
  on_screen_text: z.enum(TEXT_AMOUNTS).optional(),
  clutter: z.enum(LEVELS).optional(),
  intended_audience: z.enum(AUDIENCES).optional(),
});

export const agentOutputSchema = z.object({
  observations: observationsOutput.optional(),
  components: z.object({
    CONTENT_LANGUAGE: componentOutput,
    PACING: componentOutput,
    VISUAL_COMFORT: componentOutput,
    AUDIO_COMFORT: componentOutput.optional(),
  }),
  criteria: z.array(z.object({ key: z.string(), result: z.enum(["PASS", "FAIL", "UNKNOWN"]), evidence: z.string(), timestamps })),
  classification: z.object({
    age_min: z.number().min(0).max(6).nullable(),
    age_max: z.number().min(0).max(6).nullable(),
    category: z.string().nullable(),
    also_fits: z.array(z.string()).default([]),
    interests: z.array(z.string()).default([]),
    development_goals: z.array(z.string()).default([]),
    regulation_goals: z.array(z.string()).default([]),
    language: z.string().nullable().optional(),
  }),
  learning_objective: z.string().nullable().optional(),
  kidq_summary: z.string().min(1),
});
export type AgentOutput = z.infer<typeof agentOutputSchema>;

function firstTwoSentences(text: string): string {
  const sentences = text.trim().match(/[^.!?]+[.!?]+(?=\s|$)/g);
  return sentences ? sentences.slice(0, 2).join(" ").replace(/\s+/g, " ").trim() : text.trim().slice(0, 300);
}

export interface NormalizeContext {
  contentType: string;
  /** Picture books: the stored pages, whose text KidQ measures itself. */
  story?: StoryContent | null;
}

/**
 * Validated model output → our assessment shapes. Unknown keys are dropped; skipped criteria stay
 * UNKNOWN. What the model observed bounds its own scores and overrides a contradicting answer.
 */
export function normalizeAgentOutput(
  output: AgentOutput,
  taxonomy: Taxonomy,
  components: readonly Component[] = COMPONENTS,
  context: NormalizeContext = { contentType: "VIDEO" },
) {
  const story = context.contentType === "STORYBOOK";
  const given: ComponentInput[] = components.map((component) => {
    const value = output.components[component];
    if (!value) return { component, value: null, status: "UNAVAILABLE", selfConfidence: null, evidence: "Not returned by the AI reviewer.", timestamps: [] };
    return {
      component,
      value: Math.round(value.score),
      status: "MEASURED",
      selfConfidence: Math.round(value.self_confidence * 100) / 100,
      evidence: value.evidence.trim().slice(0, 500),
      timestamps: value.timestamps,
    };
  });
  const observed = observationBounds(output.observations);
  const book = story ? bookBounds(bookTextMetrics(context.story?.pages ?? [])) : { bounds: [], minAge: null };
  const scores = applyBounds(given, [...observed.bounds, ...book.bounds]);

  const known = new Set(RUBRIC.map((c) => c.key));
  const criteria: CriterionInput[] = [];
  for (const criterion of output.criteria) {
    if (!known.has(criterion.key) || criteria.some((c) => c.key === criterion.key)) continue;
    criteria.push({ key: criterion.key, result: criterion.result, evidence: criterion.evidence.trim().slice(0, 500) || "No evidence given.", timestamps: criterion.timestamps });
  }
  for (const definition of RUBRIC) {
    if (!criteria.some((c) => c.key === definition.key)) {
      criteria.push({ key: definition.key, result: "UNKNOWN", evidence: "Not returned by the AI reviewer.", timestamps: [] });
    }
  }
  for (const fail of observed.fails) {
    const index = criteria.findIndex((c) => c.key === fail.key);
    if (index >= 0 && criteria[index].result !== "FAIL") criteria[index] = { key: fail.key, result: "FAIL", evidence: fail.evidence, timestamps: fail.timestamps };
  }

  const allowed = (kind: Parameters<typeof keysOf>[1], values: string[]) => values.filter((value) => keysOf(taxonomy, kind).includes(value));
  let { age_min: ageMin, age_max: ageMax } = output.classification;
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  // Dense text suits older children, whatever the model suggested.
  if (book.minAge !== null && ageMin !== null && ageMin < book.minAge) {
    ageMin = book.minAge;
    if (ageMax === null || ageMax <= ageMin) ageMax = Math.min(6, ageMin + 1);
  }

  const categoryKeys = keysOf(taxonomy, "category");
  const suggested = [output.classification.category, ...output.classification.also_fits].filter(
    (key): key is string => typeof key === "string" && categoryKeys.includes(key),
  );
  const topics = [...new Set(suggested)].filter((key) => key !== "storybooks");
  const categories = (story && categoryKeys.includes("storybooks") ? ["storybooks", ...topics] : topics).slice(0, MAX_CATEGORIES);

  const classification: SuggestedClassification = {
    ageMin,
    ageMax,
    category: categories[0] ?? null,
    categories,
    interests: allowed("interest", output.classification.interests),
    developmentGoals: allowed("development_goal", output.classification.development_goals),
    regulationGoals: allowed("regulation_goal", output.classification.regulation_goals),
    language: output.classification.language ?? null,
    learningObjective: output.learning_objective ?? null,
    kidqSummary: firstTwoSentences(output.kidq_summary),
  };
  return { scores, criteria, classification };
}

function parseOutput(text: string): { ok: true; data: AgentOutput } | { ok: false; problem: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, problem: "Response was not valid JSON." };
  }
  const parsed = agentOutputSchema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, problem: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}

async function youtubeSecondsUsedToday(db: Db): Promise<number> {
  const { rows } = await db.query("SELECT COALESCE(SUM(youtube_video_seconds), 0)::int AS used FROM ai_usage_daily WHERE day = $1", [pacificDay()]);
  return rows[0].used;
}

/** True once Gemini has refused a request today because the daily quota is used up. */
async function dailyQuotaUsedUp(db: Db, model: string): Promise<boolean> {
  const { rowCount } = await db.query("SELECT 1 FROM ai_usage_daily WHERE day = $1 AND model = $2 AND quota_exhausted_at IS NOT NULL", [pacificDay(), model]);
  return (rowCount ?? 0) > 0;
}

async function markDailyQuotaUsedUp(db: Db, model: string) {
  await db.query(
    `INSERT INTO ai_usage_daily (day, model, quota_exhausted_at) VALUES ($1, $2, now())
     ON CONFLICT (day, model) DO UPDATE SET quota_exhausted_at = now()`,
    [pacificDay(), model],
  );
}

async function recordUsage(
  db: Db,
  model: string,
  usage: { youtubeSeconds: number; fileSeconds: number; inputTokens: number; outputTokens: number; costUsd: number },
) {
  await db.query(
    `INSERT INTO ai_usage_daily (day, model, youtube_video_seconds, file_video_seconds, requests, input_tokens, output_tokens, est_cost_usd)
     VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
     ON CONFLICT (day, model) DO UPDATE SET
       youtube_video_seconds = ai_usage_daily.youtube_video_seconds + EXCLUDED.youtube_video_seconds,
       file_video_seconds = ai_usage_daily.file_video_seconds + EXCLUDED.file_video_seconds,
       requests = ai_usage_daily.requests + 1,
       input_tokens = ai_usage_daily.input_tokens + EXCLUDED.input_tokens,
       output_tokens = ai_usage_daily.output_tokens + EXCLUDED.output_tokens,
       est_cost_usd = ai_usage_daily.est_cost_usd + EXCLUDED.est_cost_usd`,
    [pacificDay(), model, usage.youtubeSeconds, usage.fileSeconds, usage.inputTokens, usage.outputTokens, usage.costUsd],
  );
}

/** The scoring model, then its fallbacks (AI_FALLBACK_MODELS), without repeats. */
export function scoringModels(): string[] {
  return [...new Set([env.aiScoringModel, ...env.aiFallbackModels])];
}

interface ScoringRequest {
  target: AgentTarget;
  taxonomy: Taxonomy;
  parts: GeminiPart[];
  schema: object;
  components: readonly Component[];
  /** Video seconds each call counts against the day's allowance. */
  usage: { youtubeSeconds: number; fileSeconds: number };
}

/** One model's turn: a structured call, plus one retry if the output doesn't validate. */
async function scoreWith(db: Db, model: string, request: ScoringRequest): Promise<AgentOutcome> {
  const { target } = request;
  let problem = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await generateJson(model, request.parts, request.schema);
    const inputTokens = response.usage.promptTokenCount ?? 0;
    const outputTokens = response.usage.candidatesTokenCount ?? 0;
    const costUsd = (inputTokens * env.aiInputUsdPerMTok + outputTokens * env.aiOutputUsdPerMTok) / 1_000_000;
    await recordUsage(db, model, { ...request.usage, inputTokens, outputTokens, costUsd });

    const parsed = parseOutput(response.text);
    if (!parsed.ok) {
      problem = parsed.problem;
      continue; // one retry, then the item goes to the admin
    }
    const { scores, criteria, classification } = normalizeAgentOutput(parsed.data, request.taxonomy, request.components, {
      contentType: target.contentType,
      story: target.story,
    });
    const critical = criteria.some((c) => CRITICAL_KEYS.includes(c.key) && c.result === "FAIL");
    return {
      kind: "SCORED",
      classification,
      assessment: {
        contentItemId: target.contentItemId,
        assessorType: "MODEL",
        assessorName: "kidq-gemini-scoring-agent",
        modelName: model,
        modelSnapshot: response.modelVersion,
        promptVersion: PROMPT_VERSION,
        rubricVersion: RUBRIC_VERSION,
        inputHash: target.metadataHash,
        inputTokens,
        cachedInputTokens: response.usage.cachedContentTokenCount ?? null,
        outputTokens,
        estimatedCostUsd: costUsd,
        result: critical ? "REJECTED" : "MANUAL_REVIEW_REQUIRED",
        summary: classification.kidqSummary ?? "AI review completed.",
        audiovisualInspected: true,
        scores,
        criteria,
        classification,
        output: parsed.data,
        cacheKey: agentCacheKey(target, model),
      },
    };
  }
  return { kind: "INVALID_OUTPUT", reason: problem };
}

const MAX_STORY_IMAGES = 24;

/** A picture book in reading order: each page's text, then its illustration (small rendition, inline). */
async function storyParts(story: StoryContent): Promise<GeminiPart[]> {
  const parts: GeminiPart[] = [];
  for (const page of story.pages) {
    parts.push({ text: `Page ${page.page}: ${page.text || "(no text on this page)"}` });
    const image = page.image_small_url ?? page.image_url;
    if (image && page.page <= MAX_STORY_IMAGES) parts.push(await inlineImage(image));
  }
  return parts;
}

export async function runScoringAgent(
  db: Db,
  target: AgentTarget,
  taxonomy: Taxonomy,
  options: { force?: boolean; hasCached: (cacheKey: string) => Promise<boolean> },
): Promise<AgentOutcome> {
  if (!env.geminiApiKey) return { kind: "DISABLED" };
  const chain = scoringModels();
  if (!options.force) {
    for (const model of chain) if (await options.hasCached(agentCacheKey(target, model))) return { kind: "CACHED" };
  }

  // Permanent reasons first, so those items reach the admin now rather than after a quota wait.
  const isYouTube = target.sourceSystemId === "youtube";
  const isStory = target.contentType === "STORYBOOK";
  const seconds = target.durationSeconds ?? ASSUMED_SECONDS;
  if (isStory) {
    if (!target.allowsMediaCopy || !target.story?.pages.length) {
      return { kind: "UNAVAILABLE", reason: "Story rights do not allow sending the pages to the AI reviewer." };
    }
  } else if (!isYouTube && (!target.allowsMediaCopy || !target.mediaUrl)) {
    return { kind: "UNAVAILABLE", reason: "Media rights do not allow sending a copy to the AI reviewer." };
  } else if (!isYouTube && seconds > MAX_FILE_SECONDS) {
    return { kind: "UNAVAILABLE", reason: "Video is longer than the 20-minute AI limit for uploaded files." };
  }
  const available: string[] = [];
  for (const model of chain) if (!(await dailyQuotaUsedUp(db, model))) available.push(model);
  if (available.length === 0) return { kind: "DEFERRED", retryAt: nextPacificReset(), reason: DAILY_QUOTA_REASON };
  if (isYouTube && (await youtubeSecondsUsedToday(db)) + seconds > env.aiDailyVideoSecondsCap) {
    return { kind: "DEFERRED", retryAt: nextPacificReset(), reason: "Today's free YouTube video allowance is used up; AI scoring resumes after midnight Pacific." };
  }

  const components = componentsFor(target.contentType);
  let uploadedName: string | null = null;
  try {
    let parts: GeminiPart[];
    if (isStory) {
      parts = [{ text: buildPrompt(target, taxonomy) }, ...(await storyParts(target.story as StoryContent))];
    } else {
      let video: GeminiPart;
      if (isYouTube) {
        video = { file_data: { file_uri: `https://www.youtube.com/watch?v=${target.externalId}` } };
      } else {
        const file = await uploadMediaFile(target.mediaUrl as string, target.mediaMimeType ?? "video/mp4");
        uploadedName = file.name;
        video = {
          file_data: { file_uri: file.uri, mime_type: file.mimeType },
          ...(seconds <= SHARP_VIEW_MAX_SECONDS ? { video_metadata: { fps: SHARP_VIEW_FPS } } : {}),
        };
      }
      parts = [video, { text: buildPrompt(target, taxonomy) }];
    }
    const request: ScoringRequest = {
      target,
      taxonomy,
      parts,
      schema: responseSchema(taxonomy, components, isStory),
      components,
      usage: { youtubeSeconds: isYouTube ? seconds : 0, fileSeconds: isYouTube || isStory ? 0 : seconds },
    };

    // Each model with quota left gets a turn; one that runs out or is overloaded hands over to the next.
    let busyForMs = 0;
    for (const model of available) {
      try {
        return await scoreWith(db, model, request);
      } catch (error) {
        if (error instanceof GeminiQuotaError && error.daily) {
          await markDailyQuotaUsedUp(db, model);
        } else if (error instanceof GeminiQuotaError || (error instanceof HttpError && error.status === 503)) {
          busyForMs = Math.max(busyForMs, error instanceof GeminiQuotaError ? error.retryAfterMs : OVERLOAD_WAIT_MS);
        } else {
          throw error;
        }
      }
    }
    if (busyForMs > 0) {
      return { kind: "DEFERRED", retryAt: new Date(Date.now() + busyForMs), reason: "Gemini is overloaded or at its per-minute limit; retrying in a few minutes." };
    }
    return { kind: "DEFERRED", retryAt: nextPacificReset(), reason: DAILY_QUOTA_REASON };
  } catch (error) {
    // Private, unlisted, region-blocked or oversized media: permanent for this video.
    if (error instanceof HttpError && !error.retryable && [0, 400, 403, 404, 413, 422].includes(error.status)) {
      return { kind: "UNAVAILABLE", reason: error.message };
    }
    throw error; // transient: the job retries with backoff
  } finally {
    if (uploadedName) await deleteMediaFile(uploadedName);
  }
}
