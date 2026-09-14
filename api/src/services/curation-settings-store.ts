import { createJsonFileStore } from "../lib/json-file-store";
import type { CurationSettings } from "../types/curation-settings";
import { getParentExperienceConfig } from "./parent-config";

const settingsStore = createJsonFileStore<CurationSettings>("curation-settings.json");

/** The spec-stated defaults for a child who has never had the Hub saved for them. */
async function defaultSettings(childId: string): Promise<CurationSettings> {
  const config = await getParentExperienceConfig();
  return {
    childId,
    interests: [],
    contentMixMode: config.contentMixDefault,
    contentMixCategories: [],
    regulationGoals: [],
    // No explicit spec default for duration itself (unlike interval/break
    // type, which the spec does state defaults for) — 30 min chosen as a
    // reasonable typical-session length; parent can change any time.
    durationDefault: 30,
    breakInterval: 15,
    breakType: "alternate",
    autoplay: true,
    sensoryMode: false,
    dailySchedule: { enabled: false, startTime: "07:00", endTime: "19:00" },
    updatedAt: new Date().toISOString(),
  };
}

export async function getCurationSettings(childId: string): Promise<CurationSettings> {
  const all = await settingsStore.readAll();
  return all[childId] ?? (await defaultSettings(childId));
}

export async function saveCurationSettings(
  childId: string,
  settings: Omit<CurationSettings, "childId" | "updatedAt">
): Promise<CurationSettings> {
  let result: CurationSettings | undefined;
  await settingsStore.write((all) => {
    result = { ...settings, childId, updatedAt: new Date().toISOString() };
    all[childId] = result;
  });
  return result!;
}
