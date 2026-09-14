// Break activities (design/ prototype, PR #5): each break in a session gets an activity of its own
// type. The prototype's rotation is kept: a MOVEMENT break while the child is fresh, a QUIET one as
// the day winds down, and the final WIND_DOWN is the sunset. Pure: no I/O.
import type { WindDown } from "../time-of-day";
import type { BreakKind } from "./index";

export interface BreakActivity {
  id: string;
  key: string;
  title: string;
  instruction: string;
  spokenInstruction: string;
  durationSeconds: number;
  breakType: BreakKind;
  /** e.g. the colours for "Find 3 things"; one is picked per break. */
  variants: string[];
}

export interface AssignedBreak {
  slot: number;
  activity: BreakActivity;
  /** The chosen variant; for the sunset, the session's wind-down. */
  variant: string | null;
}

const SUNSET_LINES: Record<WindDown, string> = {
  STANDARD: "The sun is setting. What a lovely time we had together.",
  CALM: "The sun is setting slowly. Let's be calm and quiet now.",
  SLEEP: "The sun has gone to sleep. Time for you to rest too. Goodnight.",
};

const fill = (text: string, variant: string | null) => (variant ? text.split("{variant}").join(variant) : text);

/**
 * One activity per break: its type matches the break, none repeats within the session, and the
 * activities from the child's last session go last. `seed` (the child's session count) rotates variants.
 */
export function assignBreaks(
  slots: Array<{ slot: number; breakAfter: BreakKind }>,
  library: BreakActivity[],
  options: { recentKeys: string[]; windDown: WindDown; seed: number },
): AssignedBreak[] {
  const used = new Set<string>();
  let turn = options.seed;
  return slots.flatMap((slot) => {
    const pool = library.filter((activity) => activity.breakType === slot.breakAfter);
    if (pool.length === 0) return [];
    const rank = (activity: BreakActivity) => (used.has(activity.key) ? 2 : 0) + (options.recentKeys.includes(activity.key) ? 1 : 0);
    const activity = [...pool].sort((a, b) => rank(a) - rank(b))[0];
    used.add(activity.key);
    if (slot.breakAfter === "WIND_DOWN") return [{ slot: slot.slot, activity, variant: options.windDown }];
    const variant = activity.variants.length ? activity.variants[turn++ % activity.variants.length] : null;
    return [{ slot: slot.slot, activity, variant }];
  });
}

/** What child mode shows and says for a break. */
export function describeBreak(activity: BreakActivity, variant: string | null) {
  const sunset = activity.breakType === "WIND_DOWN" ? SUNSET_LINES[variant as WindDown] : undefined;
  return {
    id: activity.id,
    key: activity.key,
    title: activity.title,
    instruction: sunset ?? fill(activity.instruction, variant),
    spoken_instruction: sunset ?? fill(activity.spokenInstruction, variant),
    variant,
    duration_seconds: activity.durationSeconds,
  };
}
