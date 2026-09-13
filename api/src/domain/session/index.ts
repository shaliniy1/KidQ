// Session assembly (docs/recommendation/parent-experience.md §2–3): turns the duration a parent
// picks into ~15-minute slots, each ending in a break, filled only with whole videos from the
// child's parent-approved library, already in ranked order. Pure: no I/O.
import { breakPlan, type BreakType } from "../onboarding";

export interface SessionCandidate {
  id: string;
  durationSeconds: number | null;
  category: string | null;
  /** How calm the item is (pacing and audio comfort, 0–100); null when unknown. */
  calm: number | null;
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
export const SLOT_SECONDS = 15 * 60;
/** The last video in a slot may run this far past the slot, so no video is ever cut short. */
export const TOLERANCE_SECONDS = 3 * 60;
// An item whose length the source didn't give counts as a short video.
const UNKNOWN_SECONDS = 5 * 60;

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

export function assembleSession(
  library: SessionCandidate[],
  requestedMinutes: number,
  options: { breakType: BreakType; calmEnding: boolean },
): AssembledSession {
  const minutes = sessionMinutes(requestedMinutes);
  const slotCount = breakPlan(minutes).total_breaks;
  const kinds = breakKinds(slotCount, options.breakType);
  const remaining = [...library];
  const slots: AssembledSlot[] = [];
  let previousCategory: string | null | undefined;

  for (let index = 0; index < slotCount && remaining.length > 0; index += 1) {
    // The last slot leans calm on purpose: calmest first, rank order breaking ties.
    const calmLast = index === slotCount - 1 && options.calmEnding;
    const order = calmLast ? [...remaining].sort((a, b) => (b.calm ?? 0) - (a.calm ?? 0)) : remaining;
    const slot: AssembledSlot = { slot: index + 1, itemIds: [], seconds: 0, breakAfter: kinds[index] };
    while (slot.seconds < SLOT_SECONDS) {
      // A video starts only if it ends within the tolerance — or if it's the slot's first, which it then fills whole.
      const fits = (candidate: SessionCandidate) =>
        remaining.includes(candidate) && (slot.itemIds.length === 0 || slot.seconds + lengthOf(candidate) <= SLOT_SECONDS + TOLERANCE_SECONDS);
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
