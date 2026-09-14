export type TimeBand = "morning" | "daytime" | "evening" | "bedtime";
export type TimeBandMode = "auto" | "morning" | "daytime" | "bedtime";

export const TIME_BAND_MODES: TimeBandMode[] = ["auto", "morning", "daytime", "bedtime"];

/**
 * Layer 1 only (spec Section 2 point 8): drives opener/wind-down copy
 * selection, never which videos get picked. In Auto mode, resolved from
 * this **server's own clock** — the client sends only the selected mode,
 * never a device timestamp, so a manually changed phone clock can't
 * silently change the band.
 *
 * Note: the P7a mode chips are [Auto][Morning][Daytime][Bedtime] — there is
 * no manual "Evening" chip in the spec, only Auto's clock-based resolution
 * can ever produce "evening". Modeled that way here deliberately, not an
 * oversight.
 */
export function resolveTimeBand(mode: TimeBandMode): TimeBand {
  if (mode !== "auto") return mode;
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "daytime";
  if (hour >= 17 && hour < 20) return "evening";
  return "bedtime";
}
