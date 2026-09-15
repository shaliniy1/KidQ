"use client";

// Typed client generated from api/openapi.json (`npm run gen:api -w web`), so
// this app breaks at compile time if the API contract changes.
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

/** Keep API and infrastructure wording out of the everyday parent experience. */
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
