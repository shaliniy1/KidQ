// Autoplay, sensory-friendly mode and the daily-schedule reminder have no
// real backend field yet (only break_type is part of the real Child
// resource — see web/src/services/curation-settings.ts). Stored locally
// per child until the API grows real fields for these.
export interface LocalPreferences {
  autoplay: boolean;
  sensoryMode: boolean;
  dailySchedule: { enabled: boolean; startTime: string; endTime: string };
}

const DEFAULTS: LocalPreferences = {
  autoplay: true,
  sensoryMode: false,
  dailySchedule: { enabled: false, startTime: "07:00", endTime: "19:00" },
};

function storageKey(childId: string): string {
  return `kidq:local-preferences:${childId}`;
}

export function getLocalPreferences(childId: string): LocalPreferences {
  try {
    const raw = window.localStorage.getItem(storageKey(childId));
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveLocalPreferences(childId: string, prefs: LocalPreferences): void {
  try {
    window.localStorage.setItem(storageKey(childId), JSON.stringify(prefs));
  } catch {
    // Storage may be blocked — the setting just won't persist across visits.
  }
}
