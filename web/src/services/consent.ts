import type { User } from "firebase/auth";
import { apiFetch } from "./api";
import type { ConsentRecord, ConsentStatusResponse } from "@/types/consent";

async function authHeaders(user: User): Promise<HeadersInit> {
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

export async function getConsentStatus(user: User): Promise<ConsentStatusResponse> {
  return apiFetch<ConsentStatusResponse>("/consent", { headers: await authHeaders(user) });
}

export async function recordConsent(user: User): Promise<ConsentRecord> {
  const { consent } = await apiFetch<{ consent: ConsentRecord }>("/consent", {
    method: "POST",
    headers: await authHeaders(user),
  });
  return consent;
}
