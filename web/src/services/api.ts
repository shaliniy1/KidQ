import type { HealthResponse } from "@/types/health";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Shared fetch helper so the "API URL missing" / "request failed" checks live in one place. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }

  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request to ${path} failed with status ${res.status}`);
  }

  return res.json();
}

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}
