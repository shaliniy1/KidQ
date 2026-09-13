// Visual Comfort Mode (architecture doc §21). An amber layer multiplied over the picture removes
// some of its blue light, and a little less saturation and brightness softens it. It works on the
// device over any source, YouTube included: it changes how the picture looks, not the video, and
// KidQ makes no health claim about it.
import type { CSSProperties } from "react";

export type VisualComfort = "off" | "warm" | "warmer";

const MODES: Record<Exclude<VisualComfort, "off">, { tint: string; filter: string }> = {
  warm: { tint: "rgba(255, 160, 60, 0.16)", filter: "saturate(0.9) brightness(0.96)" },
  warmer: { tint: "rgba(255, 140, 40, 0.28)", filter: "saturate(0.8) brightness(0.92)" },
};

/** Styles for the picture itself and for the tint layer laid over it; both null when the mode is off. */
export function comfortStyles(mode: VisualComfort | undefined): { picture: CSSProperties; tint: CSSProperties } | null {
  if (!mode || mode === "off") return null;
  const { tint, filter } = MODES[mode];
  return {
    picture: { filter },
    tint: { position: "absolute", inset: 0, background: tint, mixBlendMode: "multiply", pointerEvents: "none" },
  };
}
