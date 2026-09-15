import { api, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api-types";

export type ParentAnalytics = paths["/children/{id}/analytics"]["get"]["responses"][200]["content"]["application/json"];
export type Period = NonNullable<paths["/children/{id}/analytics"]["get"]["parameters"]["query"]>["period"];

export async function getParentAnalytics(childId: string, period: Period): Promise<ParentAnalytics> {
  return unwrap(
    await api.GET("/children/{id}/analytics", { params: { path: { id: childId }, query: { period } } }),
  );
}
