"use client";

// Typed client generated from api/openapi.json (`npm run gen:api -w admin`), so the admin app
// breaks at compile time if the API contract changes.
import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./api-types";
import { getAccessToken } from "./session";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const authenticate: Middleware = {
  async onRequest({ request }) {
    const token = await getAccessToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
};

export const api = createClient<paths>({ baseUrl: API_URL });
api.use(authenticate);

// Derived from the list endpoint's response so it matches exactly what the API returns.
type ContentPage = paths["/content-items"]["get"]["responses"][200]["content"]["application/json"];
export type AdminContent = ContentPage["items"][number];
export type ContentScore = NonNullable<AdminContent["content_score"]>;

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown,
  ) {
    super(message);
  }
}

/** Returns the response data, or throws the API's { error: { code, message, details } } as ApiFailure. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    const body = result.error as { error?: { code?: string; message?: string; details?: unknown } } | undefined;
    throw new ApiFailure(
      result.response.status,
      body?.error?.code ?? "HTTP_ERROR",
      body?.error?.message ?? `Request failed (${result.response.status}).`,
      body?.error?.details ?? null,
    );
  }
  return result.data;
}

export function blockersOf(error: unknown): string[] {
  return error instanceof ApiFailure ? (((error.details as { blockers?: string[] } | null)?.blockers ?? []) as string[]) : [];
}

export const BLOCKER_LABELS: Record<string, string> = {
  CRITICAL_FLAG: "Safety flag to resolve",
  MISSING_COMPONENTS: "Scores missing",
  LOW_AI_CONFIDENCE: "AI unsure — check scores",
  MISSING_AGE: "Age not set",
  MISSING_CATEGORY: "Category not set",
  MISSING_GOAL: "Goal not set",
  NOT_PLAYABLE: "Can't be played",
  NOT_SCORED: "Not scored yet",
};

export const STATE_LABELS: Record<string, string> = {
  PENDING_ANALYSIS: "Pending analysis",
  ANALYSING: "Analysing",
  READY_TO_APPROVE: "Ready to approve",
  NEEDS_ATTENTION: "Needs attention",
  ANALYSIS_INCOMPLETE: "Analysis incomplete",
  FAILED: "Failed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
