// Parent onboarding defaults (docs/recommendation/parent-onboarding.md). A parent gives only a
// nickname and an age band per child; everything else starts from these, and "Customize" changes them.
import type { AgeBand } from "./age";

export const MAX_CHILDREN = 6;
export const CONTENT_MIXES = ["SURPRISE", "CHOSEN"] as const;
export const SESSION_MINUTES = [15, 30, 45, 60, 90] as const;
export const BREAK_TYPES = ["MOVEMENT", "QUIET", "ALTERNATE"] as const;
export type ContentMix = (typeof CONTENT_MIXES)[number];
export type SessionMinutes = (typeof SESSION_MINUTES)[number];
export type BreakType = (typeof BREAK_TYPES)[number];

/**
 * Block C, never shown to parents. A product default for the MVP, not a clinical claim: it needs
 * the same expert review as content before it's treated as authoritative.
 */
export const DEFAULT_DEVELOPMENT_GOALS: Record<AgeBand, string[]> = {
  "0_2": ["motor_skills", "communication", "emotional"],
  "2_3": ["communication", "emotional", "social"],
  "3_4": ["social", "emotional", "creativity"],
  "4_5": ["cognitive", "creativity", "problem_solving"],
  "5_6": ["cognitive", "problem_solving", "learning"],
};

/** Block E default: 15-minute sessions under 3, 30 from 3. A product default, due for review like Block C. */
export function defaultSessionMinutes(band: AgeBand): SessionMinutes {
  return band === "0_2" || band === "2_3" ? 15 : 30;
}

/** One break per 15 minutes. The last is always the wind-down (Sunset Indicator and moon mascot), never a movement or quiet break. */
export function breakPlan(sessionMinutes: number) {
  const total = Math.max(1, Math.round(sessionMinutes / 15));
  return { total_breaks: total, mid_session_breaks: total - 1, wind_down: true };
}
