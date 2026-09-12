// Minimal Gemini REST client (generativelanguage.googleapis.com, v1beta): structured JSON
// generation with a public YouTube URL or an uploaded file as video input, plus the Files API
// for licensed NASA/Wikimedia media. The key travels in a header, never in a URL.
import { env } from "../config/env";
import { HttpError, request } from "../connectors/http";

const BASE_URL = "https://generativelanguage.googleapis.com";

export interface GeminiPart {
  text?: string;
  file_data?: { file_uri: string; mime_type?: string };
  inline_data?: { mime_type: string; data: string };
}

export interface GeminiUsage {
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
}

export interface GeminiResult {
  text: string;
  usage: GeminiUsage;
  modelVersion: string | null;
}

function apiKey(): string {
  if (!env.geminiApiKey) throw new HttpError(0, "GEMINI_API_KEY is not configured.", false);
  return env.geminiApiKey;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gemini refused the request because a free-tier quota is used up. */
export class GeminiQuotaError extends HttpError {
  constructor(
    readonly daily: boolean,
    readonly retryAfterMs: number,
  ) {
    super(429, daily ? "Gemini's daily request quota is used up." : "Gemini's per-minute quota is busy.", true);
    this.name = "GeminiQuotaError";
  }
}

const MINUTE_QUOTA_RETRIES = 2;
const MAX_QUOTA_WAIT_MS = 90_000;

/**
 * Reads a 429 RESOURCE_EXHAUSTED body: a `…PerDay…` quota id means waiting for the daily reset at
 * midnight Pacific; otherwise RetryInfo says when the per-minute window frees up.
 */
export function parseQuotaError(body: unknown): { daily: boolean; retryAfterMs: number } {
  const raw = (body as { error?: { details?: unknown } } | null)?.error?.details;
  const details = (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>;
  const quotaIds = details
    .flatMap((detail) => (Array.isArray(detail.violations) ? (detail.violations as Array<{ quotaId?: unknown }>) : []))
    .map((violation) => String(violation.quotaId ?? ""));
  const retryDelay = details.map((detail) => detail.retryDelay).find((value): value is string => typeof value === "string");
  const seconds = retryDelay ? Number.parseFloat(retryDelay) : Number.NaN;
  return { daily: quotaIds.some((id) => /PerDay/i.test(id)), retryAfterMs: Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : 60_000 };
}

/** POSTs to Gemini, waiting out short per-minute limits; a used-up quota becomes a GeminiQuotaError. */
async function postWithQuota(url: string, body: string): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await request(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey() },
      body,
      retries: 2,
      timeoutMs: 240_000,
      passStatuses: [429],
    });
    if (response.status !== 429) return response;
    const quota = parseQuotaError(await response.json().catch(() => null));
    if (quota.daily || attempt >= MINUTE_QUOTA_RETRIES || quota.retryAfterMs > MAX_QUOTA_WAIT_MS) {
      throw new GeminiQuotaError(quota.daily, quota.retryAfterMs);
    }
    await sleep(quota.retryAfterMs);
  }
}

export async function generateJson(model: string, parts: GeminiPart[], responseSchema: object): Promise<GeminiResult> {
  const response = await postWithQuota(
    `${BASE_URL}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        // Temperature stays at its default: Google advises against lowering it for Gemini 3 models.
        // ~100 tokens per second of video (Gemini docs); keeps free-tier usage low.
        mediaResolution: "MEDIA_RESOLUTION_LOW",
      },
    }),
  );
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    usageMetadata?: GeminiUsage;
    modelVersion?: string;
    promptFeedback?: { blockReason?: string };
  };
  if (json.promptFeedback?.blockReason) {
    throw new HttpError(422, `Gemini blocked the request: ${json.promptFeedback.blockReason}`, false);
  }
  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) {
    throw new HttpError(502, `Gemini returned no content (finishReason=${candidate?.finishReason ?? "none"})`, candidate?.finishReason !== "SAFETY");
  }
  return { text, usage: json.usageMetadata ?? {}, modelVersion: json.modelVersion ?? null };
}

export interface UploadedFile {
  name: string;
  uri: string;
  mimeType: string;
}

/**
 * Streams a licensed media file from its source into the Gemini Files API (resumable upload).
 * Nothing is written to KidQ storage; callers must delete the upload after scoring.
 */
export async function uploadMediaFile(sourceUrl: string, mimeType: string): Promise<UploadedFile> {
  const key = apiKey();
  const source = await fetch(sourceUrl, { headers: { "user-agent": env.httpUserAgent } });
  const length = Number(source.headers.get("content-length"));
  if (!source.ok || !source.body) throw new HttpError(source.status, "Media file could not be fetched from its source.", source.status >= 500);
  if (!length || length > env.aiMaxMediaBytes) {
    await source.body.cancel();
    throw new HttpError(413, `Media file too large or of unknown size (${length || "unknown"} bytes).`, false);
  }

  const start = await request(`${BASE_URL}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "content-type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "kidq-scoring-media" } }),
    retries: 1,
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new HttpError(502, "Gemini did not return an upload URL.", true);

  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Length": String(length), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: source.body,
    duplex: "half",
  } as RequestInit);
  if (!uploaded.ok) throw new HttpError(uploaded.status, `Gemini file upload failed with HTTP ${uploaded.status}.`, uploaded.status >= 500);
  let file = ((await uploaded.json()) as { file: { name: string; uri: string; state: string } }).file;

  // Video files are processed asynchronously before they can be used.
  for (let attempt = 0; file.state === "PROCESSING" && attempt < 60; attempt += 1) {
    await sleep(5_000);
    const status = await request(`${BASE_URL}/v1beta/${file.name}`, { headers: { "x-goog-api-key": key }, retries: 2 });
    file = (await status.json()) as typeof file;
  }
  if (file.state !== "ACTIVE") {
    await deleteMediaFile(file.name);
    throw new HttpError(502, `Gemini could not process the media file (state ${file.state}).`, false);
  }
  return { name: file.name, uri: file.uri, mimeType };
}

export async function deleteMediaFile(name: string): Promise<void> {
  if (!env.geminiApiKey) return;
  await request(`${BASE_URL}/v1beta/${name}`, { method: "DELETE", headers: { "x-goog-api-key": env.geminiApiKey }, retries: 1 }).catch(() => undefined);
}

/** Fetches a small licensed image (a story illustration) as an inline part; nothing is stored. */
export async function inlineImage(url: string): Promise<GeminiPart> {
  const response = await request(url, { retries: 1 });
  const data = Buffer.from(await response.arrayBuffer()).toString("base64");
  return { inline_data: { mime_type: response.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg", data } };
}
