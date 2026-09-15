import { api, unwrap } from "@/lib/api";
import type { paths } from "@/lib/api-types";

// The "Customize Hub" fields aren't a separate curation resource on the real API —
// they're part of the Child resource itself (GET/PATCH /children/:id).
export type CurationSettings = Pick<
  paths["/children/{id}"]["patch"]["requestBody"]["content"]["application/json"],
  | "interests"
  | "content_mix"
  | "preferred_categories"
  | "regulation_goals"
  | "session_minutes"
  | "break_type"
  | "break_interval_minutes"
  | "session_mode"
  | "languages"
>;

export async function getCurationSettings(childId: string): Promise<CurationSettings> {
  const child = unwrap(await api.GET("/children/{id}", { params: { path: { id: childId } } }));
  const {
    interests,
    content_mix,
    preferred_categories,
    regulation_goals,
    session_minutes,
    break_type,
    break_interval_minutes,
    session_mode,
    languages,
  } = child;
  return { interests, content_mix, preferred_categories, regulation_goals, session_minutes, break_type, break_interval_minutes, session_mode, languages };
}

export async function saveCurationSettings(childId: string, settings: Partial<CurationSettings>) {
  return unwrap(await api.PATCH("/children/{id}", { params: { path: { id: childId } }, body: settings }));
}
