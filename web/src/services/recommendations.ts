import { api, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api-types";

export type Recommendation = paths["/children/{id}/recommendations"]["get"]["responses"][200]["content"]["application/json"]["items"][number];

export async function getRecommendations(childId: string, limit = 20, offset = 0): Promise<Recommendation[]> {
  const result = unwrap(
    await api.GET("/children/{id}/recommendations", { params: { path: { id: childId }, query: { limit, offset } } }),
  );
  return result.items;
}

export async function addToLibrary(childId: string, contentItemId: string, position?: number): Promise<void> {
  await unwrap(
    await api.POST("/children/{id}/library", {
      params: { path: { id: childId } },
      body: { content_item_id: contentItemId, state: "ADDED", position },
    }),
  );
}
