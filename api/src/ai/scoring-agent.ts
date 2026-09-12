// AI scoring agent (plan: "AI scoring agent (Gemini)"). One structured Gemini call per video
// returns the four component scores with evidence and timestamps, every rubric criterion and
// suggested tags. Our code — not the model — turns these inputs into the KidQ score, and the
// model can never approve anything.
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "../config/env";
import { HttpError } from "../connectors/http";
import type { StoryContent } from "../connectors/types";
import type { Db } from "../db/pool";
import type { SuggestedClassification } from "../domain/analysis/rules";
import { CRITICAL_KEYS, RUBRIC, RUBRIC_VERSION } from "../domain/rubric";
import { COMPONENTS, componentsFor, type Component, type ComponentInput, type CriterionInput } from "../domain/scoring";
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

const PACIFIC = "America/Los_Angeles";
const ASSUMED_SECONDS = 600;
const MAX_FILE_SECONDS = 20 * 60;
const DAILY_QUOTA_REASON = "Every Gemini model's free daily limit is used up; AI scoring resumes after midnight Pacific.";
const OVERLOAD_WAIT_MS = 2 * 60_000;

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
  return crypto.createHash("sha256").update([target.metadataHash, RUBRIC_VERSION, env.aiPromptVersion, model].join("|")).digest("hex");
}

const VIDEO_INTRO = [
  "You review videos for KidQ, a calm learning library for children aged 0–6.",
  "Watch the entire video, visuals and audio, then return JSON matching the response schema.",
  "Each evidence string is one factual sentence about what you observed, with mm:ss timestamps for the moments that drove it.",
];
const STORY_INTRO = [
  "You review picture books for KidQ, a calm learning library for children aged 0–6; parents read them aloud and early readers read them alone.",
  "Read every page and look at every illustration, then return JSON matching the response schema.",
  'Each evidence string is one factual sentence that names the pages it refers to (for example "p. 4"); leave timestamps empty.',
];
const VIDEO_COMPONENT_GUIDE = [
  "- CONTENT_LANGUAGE: safety and suitability of themes, language and behaviour.",
  "- PACING: calm, deliberate pacing. Consider cuts per minute, average shot length, rapid transitions and fast-moving sequences.",
  "- VISUAL_COMFORT: stable brightness, restrained saturation, no flashing or strobing, uncluttered scenes, limited motion.",
  "- AUDIO_COMFORT: even loudness, no sudden peaks or jarring sounds, calm narration and music.",
];
const STORY_COMPONENT_GUIDE = [
  "- CONTENT_LANGUAGE: safety and suitability of the story's themes, language and behaviour.",
  "- PACING (reading pace): how easy the story is to follow at this age: words per page, sentence length, vocabulary and repetition.",
  "- VISUAL_COMFORT (illustrations): calm, clear illustrations: restrained colours, uncluttered pages, nothing frightening.",
];

export function buildPrompt(target: AgentTarget, taxonomy: Taxonomy): string {
  const story = target.contentType === "STORYBOOK";
  const criteria = RUBRIC.map((c) => `- ${c.key} [${c.group === "FILTER_OUT" ? "FAIL if present" : "PASS if present"}]: ${c.description}`);
  return [
    ...(story ? STORY_INTRO : VIDEO_INTRO),
    "Never guess: use UNKNOWN for a criterion you could not judge, and lower self_confidence when unsure.",
    "",
    "Score each component 0–100, where higher is better for a young child:",
    ...(story ? STORY_COMPONENT_GUIDE : VIDEO_COMPONENT_GUIDE),
    "",
    "Report every critical safety problem through its criterion: sexual or explicit content → mature_themes;",
    "graphic or strong violence → physical_violence; behaviour a child could copy and get hurt → dangerous_behaviour;",
    "severe abusive language or bullying → verbal_or_emotional_aggression; disturbing or highly frightening content → frightening_imagery;",
    "hateful stereotypes → discrimination_or_stereotypes.",
    "",
    story ? "Return a result for every rubric criterion (UNKNOWN for criteria about sound, motion or video editing):" : "Return a result for every rubric criterion:",
    ...criteria,
    "",
    "Suggest tags using only these keys.",
    `category (exactly one): ${keysOf(taxonomy, "category").join(", ")}`,
    `interests: ${keysOf(taxonomy, "interest").join(", ")}`,
    `development_goals: ${keysOf(taxonomy, "development_goal").join(", ")}`,
    `regulation_goals: ${keysOf(taxonomy, "regulation_goal").join(", ")}`,
    story ? "language: ISO 639-1 code of the story's language." : "language: ISO 639-1 code of the spoken language, or null if there is no speech.",
    "age_min / age_max: youngest and oldest suitable age between 0 and 6 (KidQ groups: 0–2, 2–4, 4–6).",
    "kidq_summary: at most two sentences for parents. learning_objective: one sentence, or null.",
    "",
    `Source metadata (may be incomplete; the ${story ? "book" : "video"} itself is the evidence):`,
    `title: ${target.title}`,
    `creator: ${target.creator ?? "unknown"}`,
    story ? `pages: ${target.story?.pages.length ?? 0}` : `duration_seconds: ${target.durationSeconds ?? "unknown"}`,
    `description: ${(target.description ?? "").slice(0, 500)}`,
  ].join("\n");
}

function responseSchema(taxonomy: Taxonomy, components: readonly Component[]) {
  const strings = (values?: string[]) => ({ type: "ARRAY", items: values?.length ? { type: "STRING", enum: values } : { type: "STRING" } });
  const component = {
    type: "OBJECT",
    properties: { score: { type: "INTEGER" }, evidence: { type: "STRING" }, timestamps: strings(), self_confidence: { type: "NUMBER" } },
    required: ["score", "evidence", "timestamps", "self_confidence"],
  };
  return {
    type: "OBJECT",
    properties: {
      components: { type: "OBJECT", properties: Object.fromEntries(components.map((c) => [c, component])), required: [...components] },
      criteria: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            key: { type: "STRING", enum: RUBRIC.map((c) => c.key) },
            result: { type: "STRING", enum: ["PASS", "FAIL", "UNKNOWN"] },
            evidence: { type: "STRING" },
            timestamps: strings(),
          },
          required: ["key", "result", "evidence", "timestamps"],
        },
      },
      classification: {
        type: "OBJECT",
        properties: {
          age_min: { type: "NUMBER" },
          age_max: { type: "NUMBER" },
          category: { type: "STRING", enum: keysOf(taxonomy, "category") },
          interests: strings(keysOf(taxonomy, "interest")),
          development_goals: strings(keysOf(taxonomy, "development_goal")),
          regulation_goals: strings(keysOf(taxonomy, "regulation_goal")),
          language: { type: "STRING", nullable: true },
        },
        required: ["age_min", "age_max", "category", "interests", "development_goals", "regulation_goals", "language"],
      },
      learning_objective: { type: "STRING", nullable: true },
      kidq_summary: { type: "STRING" },
    },
    required: ["components", "criteria", "classification", "learning_objective", "kidq_summary"],
  };
}

const TIMESTAMP = /^\d{1,2}:\d{2}(?::\d{2})?$/;
const timestamps = z
  .array(z.string())
  .default([])
  .transform((values) => values.map((value) => value.trim()).filter((value) => TIMESTAMP.test(value)).slice(0, 10));
const componentOutput = z.object({ score: z.number().min(0).max(100), evidence: z.string().min(1), timestamps, self_confidence: z.number().min(0).max(1) });

export const agentOutputSchema = z.object({
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

/** Validated model output → our assessment shapes. Unknown keys are dropped; skipped criteria stay UNKNOWN. */
export function normalizeAgentOutput(output: AgentOutput, taxonomy: Taxonomy, components: readonly Component[] = COMPONENTS) {
  const scores: ComponentInput[] = components.map((component) => {
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

  const allowed = (kind: Parameters<typeof keysOf>[1], values: string[]) => values.filter((value) => keysOf(taxonomy, kind).includes(value));
  let { age_min: ageMin, age_max: ageMax } = output.classification;
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  const category = output.classification.category;
  const classification: SuggestedClassification = {
    ageMin,
    ageMax,
    category: category && keysOf(taxonomy, "category").includes(category) ? category : null,
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
    const { scores, criteria, classification } = normalizeAgentOutput(parsed.data, request.taxonomy, request.components);
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
        promptVersion: env.aiPromptVersion,
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
        video = { file_data: { file_uri: file.uri, mime_type: file.mimeType } };
      }
      parts = [video, { text: buildPrompt(target, taxonomy) }];
    }
    const request: ScoringRequest = {
      target,
      taxonomy,
      parts,
      schema: responseSchema(taxonomy, components),
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
