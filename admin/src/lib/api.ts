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
export type Dashboard = paths["/dashboard"]["get"]["responses"][200]["content"]["application/json"];

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

/** Keep API and infrastructure wording out of the everyday admin experience. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (!(error instanceof Error)) return fallback;
  if (error.message === "Failed to fetch" || /network|fetch/i.test(error.message)) {
    return "KidQ could not connect right now. Check your connection and try again.";
  }
  if (error instanceof ApiFailure) {
    if (error.status === 401) return "Your session has ended. Please sign in again.";
    if (error.status >= 500) return "KidQ could not complete that action. Please try again.";
  }
  return error.message || fallback;
}

export type SimpleStatus = "published" | "draft" | "review" | "changes";

export function simpleStatus(item: Pick<AdminContent, "studio_state" | "current_status">): { key: SimpleStatus; label: string } {
  switch (item.studio_state) {
    case "APPROVED":
      return { key: "published", label: "Published" };
    case "REJECTED":
      return { key: "changes", label: "Rejected" };
    case "NEEDS_ATTENTION":
      return { key: "changes", label: "Needs changes" };
    case "PENDING_ANALYSIS":
      return { key: "draft", label: "Draft" };
    default:
      return { key: "review", label: "Ready to publish" };
  }
}

export const BLOCKER_LABELS: Record<string, string> = {
  CRITICAL_FLAG: "Complete the safety check",
  MISSING_COMPONENTS: "Complete the content review",
  LOW_AI_CONFIDENCE: "Check the suggested details",
  MISSING_AGE: "Choose an age group",
  MISSING_CATEGORY: "Choose a category",
  MISSING_GOAL: "Add a learning goal",
  NOT_PLAYABLE: "Check that the content plays",
  NOT_SCORED: "Complete the content review",
};

export const STATE_LABELS: Record<string, string> = {
  PENDING_ANALYSIS: "Draft",
  READY_TO_APPROVE: "Ready to publish",
  NEEDS_ATTENTION: "Needs changes",
  APPROVED: "Published",
  REJECTED: "Rejected",
};
