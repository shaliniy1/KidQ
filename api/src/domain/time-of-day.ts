// Time-of-day context (docs/recommendation/parent-experience.md §12): the clock, read in IST, or the
// parent's session mode decides a session's opener, how calm its videos lean and how it winds down.
// It never changes slot filling, rotation or the never-cut-a-video rule. Pure: no I/O.

export const SESSION_MODES = ["AUTO", "MORNING", "DAYTIME", "BEDTIME"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];
/** The modes a video can suit, as tagged by the AI (or an admin). */
export const CONTENT_MODES = ["MORNING", "DAYTIME", "BEDTIME"] as const;
export type ContentMode = (typeof CONTENT_MODES)[number];
export const TIME_BANDS = ["MORNING", "DAYTIME", "EVENING", "NIGHT"] as const;
export type TimeBand = (typeof TIME_BANDS)[number];
export const WIND_DOWNS = ["STANDARD", "CALM", "SLEEP"] as const;
export type WindDown = (typeof WIND_DOWNS)[number];

/** Bands follow India's clock even on a device set to another time zone (§12.2). */
export const BAND_TIME_ZONE = "Asia/Kolkata";
/** The energy bias eases across each band change over this many minutes either side. */
export const EASE_MINUTES = 30;
const BAND_STARTS: Array<[number, TimeBand]> = [
  [5 * 60, "MORNING"],
  [11 * 60, "DAYTIME"],
  [16 * 60, "EVENING"],
  [19 * 60, "NIGHT"],
];
/** −1 leans calm, +1 leans bright. */
const BAND_BIAS: Record<TimeBand, number> = { MORNING: 1, DAYTIME: 0.3, EVENING: -0.4, NIGHT: -1 };
const MODE_BAND: Record<Exclude<SessionMode, "AUTO">, TimeBand> = { MORNING: "MORNING", DAYTIME: "DAYTIME", BEDTIME: "NIGHT" };
const DAY = 24 * 60;

export function minutesOfDay(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: BAND_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

function bandAtMinute(minute: number): TimeBand {
  let band: TimeBand = "NIGHT";
  for (const [start, name] of BAND_STARTS) if (minute >= start) band = name;
  return band;
}

export function timeBand(at: Date): TimeBand {
  return bandAtMinute(minutesOfDay(at));
}

/** The clock's energy bias, shifting gradually across band changes rather than snapping. */
export function energyBias(at: Date): number {
  const minute = minutesOfDay(at);
  for (const [start, band] of BAND_STARTS) {
    let offset = minute - start;
    if (offset > DAY / 2) offset -= DAY;
    if (offset < -DAY / 2) offset += DAY;
    if (Math.abs(offset) < EASE_MINUTES) {
      const before = bandAtMinute((start - 1 + DAY) % DAY);
      const progress = (offset + EASE_MINUTES) / (2 * EASE_MINUTES);
      return Math.round((BAND_BIAS[before] + (BAND_BIAS[band] - BAND_BIAS[before]) * progress) * 100) / 100;
    }
  }
  return BAND_BIAS[bandAtMinute(minute)];
}

/** The opener's flavour: the parent's mode, or the clock on Auto. */
export function openerBand(mode: SessionMode, band: TimeBand): TimeBand {
  return mode === "AUTO" ? band : MODE_BAND[mode];
}

export interface SessionContext {
  timeBand: TimeBand;
  mode: SessionMode;
  opener: TimeBand;
  contentMode: ContentMode;
  bias: number;
  windDown: WindDown;
}

/** When signals disagree: the parent's mode for this session, then a calming regulation goal, then the clock (§12.3). */
export function sessionContext(at: Date, mode: SessionMode, calmingGoal: boolean): SessionContext {
  const band = timeBand(at);
  const flavour = openerBand(mode, band);
  const clockBias = energyBias(at);
  const bias = mode !== "AUTO" ? BAND_BIAS[flavour] : calmingGoal ? Math.min(clockBias, 0) : clockBias;
  const contentMode: ContentMode = flavour === "NIGHT" ? "BEDTIME" : flavour === "MORNING" ? "MORNING" : "DAYTIME";
  // A late-night session always ends on the full sleep wind-down, whatever the mode (§12.4).
  const windDown: WindDown = flavour === "NIGHT" || band === "NIGHT" ? "SLEEP" : flavour === "EVENING" || calmingGoal ? "CALM" : "STANDARD";
  return { timeBand: band, mode, opener: flavour, contentMode, bias, windDown };
}
