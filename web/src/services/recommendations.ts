import type { User } from "firebase/auth";
import { apiFetch } from "./api";
import type { RecommendationCard } from "@/types/recommendation";

async function authHeaders(user: User): Promise<HeadersInit> {
  return { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" };
}

export async function getRecommendations(user: User, childId: string): Promise<RecommendationCard[]> {
  const { cards } = await apiFetch<{ cards: RecommendationCard[] }>(`/children/${childId}/recommendations`, {
    headers: await authHeaders(user),
  });
  return cards;
}

export async function addToLibrary(user: User, childId: string, contentIds: string[]): Promise<void> {
  await apiFetch(`/children/${childId}/library`, {
    method: "POST",
    headers: await authHeaders(user),
    body: JSON.stringify({ contentIds }),
  });
}
