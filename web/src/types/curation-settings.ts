export type ContentMixMode = "surprise_us" | "choose_categories";
export type BreakType = "movement" | "quiet_calm" | "alternate";

export const REGULATION_GOALS: { label: string; tag: string }[] = [
  { label: "Help them calm down", tag: "Calm" },
  { label: "Manage big feelings", tag: "Emotional Regulation" },
  { label: "Build focus", tag: "Focus" },
  { label: "Burn off energy", tag: "Movement" },
  { label: "Wind down before bed", tag: "Relaxation" },
  { label: "Play nicely with others", tag: "Social Regulation" },
];

export const DURATION_OPTIONS = [10, 15, 30, 45, 60, 90] as const;
export const BREAK_INTERVAL_OPTIONS = [10, 15, 20] as const;
export const BREAK_TYPES: { label: string; value: BreakType }[] = [
  { label: "Movement", value: "movement" },
  { label: "Quiet-calm", value: "quiet_calm" },
  { label: "Let KidQ alternate", value: "alternate" },
];

export interface DailySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface CurationSettings {
  childId: string;
  interests: string[];
  contentMixMode: ContentMixMode;
  contentMixCategories: string[];
  regulationGoals: string[];
  durationDefault: (typeof DURATION_OPTIONS)[number];
  breakInterval: (typeof BREAK_INTERVAL_OPTIONS)[number];
  breakType: BreakType;
  autoplay: boolean;
  sensoryMode: boolean;
  dailySchedule: DailySchedule;
  updatedAt: string;
}

/** total breaks = duration ÷ interval, rounded — spec Section 1 Block E / Section 2 Rule 1. */
export function computeBreakCount(durationMinutes: number, intervalMinutes: number): number {
  return Math.max(1, Math.round(durationMinutes / intervalMinutes));
}
