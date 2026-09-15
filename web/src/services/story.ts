import { api, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api-types";

export type Story = paths["/content-items/{id}/story"]["get"]["responses"][200]["content"]["application/json"];

export async function getStory(contentItemId: string): Promise<Story> {
  return unwrap(await api.GET("/content-items/{id}/story", { params: { path: { id: contentItemId } } }));
}
