import type { User } from "firebase/auth";
import { apiFetch } from "./api";
import type { AnalyticsSummary, TimeRange } from "@/types/analytics";

export async function getAnalyticsSummary(user: User, childId: string, range: TimeRange): Promise<AnalyticsSummary> {
  const idToken = await user.getIdToken();
  const { summary } = await apiFetch<{ summary: AnalyticsSummary }>(`/children/${childId}/analytics?range=${range}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return summary;
}
