import type { KidQUser } from "./auth";
import { apiFetch } from "./api";
import type { ConsentRecord, ConsentStatusResponse } from "@/types/consent";

async function authHeaders(user: KidQUser): Promise<HeadersInit> {
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

export async function getConsentStatus(user: KidQUser): Promise<ConsentStatusResponse> {
  return apiFetch<ConsentStatusResponse>("/consent", { headers: await authHeaders(user) });
}

export async function recordConsent(user: KidQUser): Promise<ConsentRecord> {
  const { consent } = await apiFetch<{ consent: ConsentRecord }>("/consent", {
    method: "POST",
    headers: await authHeaders(user),
  });
  return consent;
}
