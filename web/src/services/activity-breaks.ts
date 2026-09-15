import { api, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api-types";

export type ParentActivity = paths["/activities"]["get"]["responses"][200]["content"]["application/json"]["moving"][number];
export type ActivityBreakpoint = { timestamp_seconds: number; activity_id: string };

export async function getActivities() {
  return unwrap(await api.GET("/activities"));
}

export async function saveActivityBreakpoints(childId: string, contentItemId: string, breakpoints: ActivityBreakpoint[]) {
  return unwrap(await api.PUT("/children/{id}/library/{contentItemId}/breakpoints", {
    params: { path: { id: childId, contentItemId } },
    body: { breakpoints },
  }));
}
