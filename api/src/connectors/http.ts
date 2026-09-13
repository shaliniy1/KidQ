// HTTP client for source APIs (README "Fetch and retry policy"): descriptive user agent,
// timeouts, bounded exponential backoff with jitter on timeouts/429/5xx, Retry-After honoured,
// no retry on other 4xx, and credentials redacted from every error message.
import { env } from "../config/env";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const SECRET_PARAMS = ["key", "api_key", "apikey", "access_token", "token", "client_secret"];
const BASE_DELAY_MS = env.nodeEnv === "test" ? 1 : 500;

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of SECRET_PARAMS) if (parsed.searchParams.has(param)) parsed.searchParams.set(param, "REDACTED");
    return parsed.toString();
  } catch {
    return "[unparseable url]";
  }
}

/** Remove anything that looks like a credential from free text before it is logged or stored. */
export function redactText(text: string): string {
  return text
    .replace(/([?&](?:key|api_key|apikey|access_token|token|client_secret)=)[^&\s"]+/gi, "$1REDACTED")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer REDACTED");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const backoff = (attempt: number) => Math.min(8_000, BASE_DELAY_MS * 2 ** attempt) + Math.random() * BASE_DELAY_MS * 0.5;

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  retries?: number;
  timeoutMs?: number;
  /** Statuses handed back to the caller as-is instead of being retried or thrown. */
  passStatuses?: number[];
}

export async function request(url: string, options: RequestOptions = {}): Promise<Response> {
  const retries = options.retries ?? 3;
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
    try {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: { "user-agent": env.httpUserAgent, ...options.headers },
        body: options.body,
        signal: controller.signal,
      });
      if (response.ok || options.passStatuses?.includes(response.status)) return response;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= retries) {
        throw new HttpError(response.status, `${redactUrl(url)} returned HTTP ${response.status}`, retryable);
      }
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : backoff(attempt));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      // Network failure or timeout: transient.
      if (attempt >= retries) {
        const reason = error instanceof Error ? error.name : "network error";
        throw new HttpError(0, `${redactUrl(url)} failed: ${reason}`, true);
      }
      await sleep(backoff(attempt));
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function fetchJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(url, { ...options, headers: { accept: "application/json", ...options.headers } });
  return (await response.json()) as T;
}
