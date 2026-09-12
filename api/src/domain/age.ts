// KidQ age groups (confirmed: 0–2, 2–4, 4–6). Items store age_min/age_max; bands are derived.
export const AGE_GROUPS = [
  { key: "0_2", min: 0, max: 2 },
  { key: "2_4", min: 2, max: 4 },
  { key: "4_6", min: 4, max: 6 },
] as const;

export function ageBandsFor(min: number | null, max: number | null): string[] {
  if (min === null || max === null) return [];
  return AGE_GROUPS.filter(
    (group) => (min < group.max && max > group.min) || (min === max && min >= group.min && min <= group.max),
  ).map((group) => group.key);
}
