// KidQ age bands — the same five for admin tagging and parent onboarding (architecture doc §9,
// docs/recommendation/parent-onboarding.md). Items store age_min/age_max; bands are derived.
export const AGE_GROUPS = [
  { key: "0_2", min: 0, max: 2 },
  { key: "2_3", min: 2, max: 3 },
  { key: "3_4", min: 3, max: 4 },
  { key: "4_5", min: 4, max: 5 },
  { key: "5_6", min: 5, max: 6 },
] as const;

export type AgeBand = (typeof AGE_GROUPS)[number]["key"];
export const AGE_BAND_KEYS = AGE_GROUPS.map((group) => group.key) as [AgeBand, ...AgeBand[]];

const MAX_AGE = 6;
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export function ageBandsFor(min: number | null, max: number | null): string[] {
  if (min === null || max === null) return [];
  return AGE_GROUPS.filter(
    (group) => (min < group.max && max > group.min) || (min === max && min >= group.min && min <= group.max),
  ).map((group) => group.key);
}

/** A child's age today, estimated from the band the parent picked (its midpoint) plus the time since. */
export function ageFromBand(band: AgeBand, setOn: Date, now = new Date()): number {
  const group = AGE_GROUPS.find((candidate) => candidate.key === band) ?? AGE_GROUPS[0];
  const elapsed = Math.max(0, (now.getTime() - setOn.getTime()) / YEAR_MS);
  return Math.min(MAX_AGE, Math.round(((group.min + group.max) / 2 + elapsed) * 10) / 10);
}

/** The band an age falls in; anything from 5 up stays in the oldest band. */
export function bandForAge(age: number): AgeBand {
  return (AGE_GROUPS.find((group) => age < group.max) ?? AGE_GROUPS[AGE_GROUPS.length - 1]).key;
}
