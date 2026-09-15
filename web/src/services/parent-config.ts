import { api, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api-types";

export type Taxonomy = paths["/taxonomy"]["get"]["responses"][200]["content"]["application/json"];

/**
 * Categories, interests, regulation goals, languages and age bands — the
 * real backend-owned config (GET /taxonomy), keyed by taxonomy kind. There
 * is no separate age-band-defaults endpoint: defaults are already applied
 * server-side to a child created with only a nickname + age band.
 */
export async function getTaxonomy(): Promise<Taxonomy> {
  return unwrap(await api.GET("/taxonomy"));
}
