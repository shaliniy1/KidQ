import type { User } from "firebase/auth";
import { apiFetch } from "./api";

export interface NluCurationResult {
  interests: string[];
  contentMixMode: "surprise_us" | "choose_categories";
  contentMixCategories: string[];
  regulationGoals: string[];
}

export async function extractCurationTags(user: User, transcript: string): Promise<NluCurationResult> {
  const idToken = await user.getIdToken();
  return apiFetch<NluCurationResult>("/nlu/curation", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
}
