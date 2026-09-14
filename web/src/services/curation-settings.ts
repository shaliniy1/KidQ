import type { User } from "firebase/auth";
import { apiFetch } from "./api";
import type { CurationSettings } from "@/types/curation-settings";

async function authHeaders(user: User): Promise<HeadersInit> {
  return { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" };
}

export async function getCurationSettings(user: User, childId: string): Promise<CurationSettings> {
  const { settings } = await apiFetch<{ settings: CurationSettings }>(`/children/${childId}/curation`, {
    headers: await authHeaders(user),
  });
  return settings;
}

export async function saveCurationSettings(
  user: User,
  childId: string,
  settings: Omit<CurationSettings, "childId" | "updatedAt">
): Promise<CurationSettings> {
  const { settings: saved } = await apiFetch<{ settings: CurationSettings }>(`/children/${childId}/curation`, {
    method: "PUT",
    headers: await authHeaders(user),
    body: JSON.stringify(settings),
  });
  return saved;
}
