// Session assembly (docs/recommendation/parent-experience.md §2–3, §12): turns the duration a parent
// picks into slots of the child's break interval, each ending in a break, filled only with whole videos
// from the child's parent-approved library. The time of day (or the parent's session mode) and "today,
// lean toward…" decide which videos lead; they never change the slot mechanics. Pure: no I/O.
import { breakPlan, DEFAULT_BREAK_INTERVAL, type BreakType } from "../onboarding";
import type { ContentMode } from "../time-of-day";

export interface SessionCandidate {
  id: string;
  durationSeconds: number | null;
  /** The rotation key: the item's parent category, or its admin category when none covers it. */
  category: string | null;
  /** How calm the item is (pacing and audio comfort, 0–100); null when unknown. */
  calm: number | null;
  /** Every parent category the item falls under. */
  groups?: string[];
  /** The session modes the item was tagged for; empty fits any. */
  modes?: string[];
}

export interface AssembleOptions {
  breakType: BreakType;
  calmEnding: boolean;
  /** Minutes between breaks (Block E): 10, 15 or 20. */
  intervalMinutes?: number;
  /** The mode videos should suit; at BEDTIME, videos tagged only for livelier times are left out. */
  contentMode?: ContentMode;
  /** −1 leans calm … +1 leans bright. */
  bias?: number;
  /** "Today, lean toward…": this parent category goes first; nothing is filtered out. */
  leanToward?: string | null;
}

export type BreakKind = "MOVEMENT" | "QUIET" | "WIND_DOWN";

export interface AssembledSlot {
  slot: number;
  itemIds: string[];
  seconds: number;
  /** The break after this slot; the last slot's is always the wind-down. */
  breakAfter: BreakKind;
}

export interface AssembledSession {
  minutes: number;
  slots: AssembledSlot[];
  plannedSeconds: number;
  filledSeconds: number;
  /** The library ran short of the chosen time by this many minutes (0 when it filled it). */
  shortByMinutes: number;
}

export const PRESET_MINUTES = [15, 30, 45, 60, 90];
/** The last video in a slot may run this far past the slot, so no video is ever cut short. */
export const TOLERANCE_SECONDS = 3 * 60;
// An item whose length the source didn't give counts as a short video.
const UNKNOWN_SECONDS = 5 * 60;
/** At bedtime, an untagged video this calm or calmer still fits. */
export const BEDTIME_MIN_CALM = 60;
// Rank spans 0–1, so a boost of 1 or more moves a whole group ahead while rank still orders within it:
// the parent's "lean toward" first, then videos tagged for this session's mode. The energy bias only nudges.
const LEAN_BOOST = 2;
const MODE_BOOST = 1;
const BIAS_WEIGHT = 0.4;

/** A preset stands; a custom length snaps to the nearest 30-minute block, at least 30. */
export function sessionMinutes(requested: number): number {
  if (PRESET_MINUTES.includes(requested)) return requested;
  return Math.max(30, Math.round(requested / 30) * 30);
}

function breakKinds(count: number, type: BreakType): BreakKind[] {
  return Array.from({ length: count }, (_, index): BreakKind => {
    if (index === count - 1) return "WIND_DOWN";
    if (type === "ALTERNATE") return index % 2 === 0 ? "MOVEMENT" : "QUIET";
    return type;
  });
}

const lengthOf = (candidate: SessionCandidate) => candidate.durationSeconds ?? UNKNOWN_SECONDS;

/**
 * The ranked library, re-ordered for this session: rank still counts most, then fit to the session's
 * mode, "lean toward", and the energy bias. At bedtime, livelier videos stay out while calmer ones remain.
 */
export function orderForSession(library: SessionCandidate[], options: Omit<AssembleOptions, "breakType" | "calmEnding">): SessionCandidate[] {
  const bedtime = options.contentMode === "BEDTIME";
  const unsuited = (candidate: SessionCandidate) =>
    bedtime && (candidate.modes?.length ? !candidate.modes.includes("BEDTIME") : candidate.calm !== null && candidate.calm < BEDTIME_MIN_CALM);
  const suited = library.filter((candidate) => !unsuited(candidate));
  const pool = suited.length > 0 ? suited : library;
  const bias = options.bias ?? 0;
  const score = (candidate: SessionCandidate, index: number) =>
    1 -
    index / Math.max(1, pool.length) +
    (options.contentMode && candidate.modes?.includes(options.contentMode) ? MODE_BOOST : 0) +
    (options.leanToward && candidate.groups?.includes(options.leanToward) ? LEAN_BOOST : 0) -
    BIAS_WEIGHT * bias * (((candidate.calm ?? 50) - 50) / 50);
  return pool
    .map((candidate, index) => ({ candidate, score: score(candidate, index) }))
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate);
}

export function assembleSession(library: SessionCandidate[], requestedMinutes: number, options: AssembleOptions): AssembledSession {
  const minutes = sessionMinutes(requestedMinutes);
  const interval = options.intervalMinutes ?? DEFAULT_BREAK_INTERVAL;
  const slotSeconds = interval * 60;
  const slotCount = breakPlan(minutes, interval).total_breaks;
  const kinds = breakKinds(slotCount, options.breakType);
  const remaining = orderForSession(library, options);
  const slots: AssembledSlot[] = [];
  let previousCategory: string | null | undefined;

  for (let index = 0; index < slotCount && remaining.length > 0; index += 1) {
    // The last slot leans calm on purpose: calmest first, session order breaking ties.
    const calmLast = index === slotCount - 1 && options.calmEnding;
    const order = calmLast ? [...remaining].sort((a, b) => (b.calm ?? 0) - (a.calm ?? 0)) : remaining;
    const slot: AssembledSlot = { slot: index + 1, itemIds: [], seconds: 0, breakAfter: kinds[index] };
    while (slot.seconds < slotSeconds) {
      // A video starts only if it ends within the tolerance — or if it's the slot's first, which it then fills whole.
      const fits = (candidate: SessionCandidate) =>
        remaining.includes(candidate) && (slot.itemIds.length === 0 || slot.seconds + lengthOf(candidate) <= slotSeconds + TOLERANCE_SECONDS);
      const pick = order.find((candidate) => fits(candidate) && candidate.category !== previousCategory) ?? order.find(fits);
      if (!pick) break;
      remaining.splice(remaining.indexOf(pick), 1);
      slot.itemIds.push(pick.id);
      slot.seconds += lengthOf(pick);
      previousCategory = pick.category;
    }
    if (slot.itemIds.length > 0) slots.push(slot);
  }

  // However short the library, the session still ends with the wind-down.
  if (slots.length > 0) slots[slots.length - 1].breakAfter = "WIND_DOWN";
  const plannedSeconds = minutes * 60;
  const filledSeconds = slots.reduce((sum, slot) => sum + slot.seconds, 0);
  return {
    minutes,
    slots,
    plannedSeconds,
    filledSeconds,
    shortByMinutes: filledSeconds >= plannedSeconds - TOLERANCE_SECONDS ? 0 : Math.round((plannedSeconds - filledSeconds) / 60),
  };
}
