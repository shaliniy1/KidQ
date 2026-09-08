import type { HealthResponse } from "@/types/health";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getHealth(): Promise<HealthResponse> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }

  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }

  return res.json();
}
