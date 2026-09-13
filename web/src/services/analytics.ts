// Parent Analytics data. Uses the real API when NEXT_PUBLIC_API_URL and a parent token are set;
// otherwise the clearly marked sample data in features/analytics/mock.ts.
// Until Supabase login lands in web, the token is NEXT_PUBLIC_DEV_PARENT_TOKEN (AUTH_MODE=dev only),
// e.g. dev:parent:22222222-2222-4222-8222-222222222222.
import { MOCK_CHILDREN, mockAnalytics } from "@/features/analytics/mock";
import type { AnalyticsEvent, ChildSummary, ParentAnalytics, Period } from "@/types/analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const TOKEN = process.env.NEXT_PUBLIC_DEV_PARENT_TOKEN;

export const usingSampleData = !API_URL || !TOKEN;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: TOKEN?.startsWith("Bearer ") ? TOKEN : `Bearer ${TOKEN}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`${path} failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

export async function loadChildren(): Promise<ChildSummary[]> {
  if (usingSampleData) return MOCK_CHILDREN;
  const me = await api<{ parent: { timezone: string }; children: ChildSummary[] }>("/me");
  // "Today" and morning/evening follow the parent's own clock.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone && me.parent.timezone !== timezone) await api("/me", { method: "PATCH", body: JSON.stringify({ timezone }) }).catch(() => undefined);
  return me.children.map(({ id, nickname }) => ({ id, nickname }));
}

export async function loadAnalytics(childId: string, period: Period): Promise<ParentAnalytics> {
  if (usingSampleData) return mockAnalytics(childId, period);
  return api<ParentAnalytics>(`/children/${childId}/analytics?period=${period}`);
}

export async function postEvents(childId: string, events: AnalyticsEvent[], options: { keepalive: boolean }): Promise<void> {
  if (usingSampleData) return;
  await api(`/children/${childId}/events`, { method: "POST", body: JSON.stringify({ events }), keepalive: options.keepalive });
}
