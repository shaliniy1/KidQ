// Evidence rules for the AI's scores (docs/recommendation/README.md "Evidence rules"): what the AI
// says it saw and heard bounds the scores it gives, and KidQ measures picture-book text itself.
// Pure: no I/O.
import type { Component, ComponentInput } from "./index";

export const PALETTES = ["SOFT_NATURAL", "BRIGHT", "HARSH"] as const;
export const LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export const LOUDNESS = ["SILENT", "QUIET_EVEN", "LIVELY", "LOUD_SPIKY"] as const;
export const SPEECH_PACES = ["NONE", "SLOW", "MODERATE", "FAST"] as const;
export const MUSIC = ["NONE", "CALM", "UPBEAT", "INTENSE"] as const;
export const TEXT_AMOUNTS = ["NONE", "SOME", "HEAVY"] as const;
export const AUDIENCES = ["YOUNG_CHILDREN", "OLDER_CHILDREN", "GENERAL", "ADULTS"] as const;

/** What the AI reports seeing and hearing, before it judges anything. Books report only the visual fields. */
export interface Observations {
  cuts_per_minute?: number | null;
  motion?: (typeof LEVELS)[number];
  palette?: (typeof PALETTES)[number];
  flashing_moments?: string[];
  loudness?: (typeof LOUDNESS)[number];
  sudden_loud_moments?: string[];
  speech_pace?: (typeof SPEECH_PACES)[number];
  music?: (typeof MUSIC)[number];
  on_screen_text?: (typeof TEXT_AMOUNTS)[number];
  clutter?: (typeof LEVELS)[number];
  intended_audience?: (typeof AUDIENCES)[number];
}

export interface Bound {
  component: Component;
  max: number;
  reason: string;
}

/** A check the observations prove failed, whatever the AI answered for it. */
export interface ForcedFail {
  key: string;
  evidence: string;
  timestamps: string[];
}

export function observationBounds(observations: Observations | undefined): { bounds: Bound[]; fails: ForcedFail[] } {
  const bounds: Bound[] = [];
  const fails: ForcedFail[] = [];
  if (!observations) return { bounds, fails };

  const cuts = observations.cuts_per_minute;
  if (typeof cuts === "number" && cuts > 20) {
    bounds.push({ component: "PACING", max: cuts > 30 ? 40 : 55, reason: `about ${Math.round(cuts)} cuts a minute` });
  }
  if (observations.motion === "HIGH") bounds.push({ component: "PACING", max: 70, reason: "constant fast motion" });

  const flashes = observations.flashing_moments ?? [];
  if (flashes.length > 0) {
    bounds.push({ component: "VISUAL_COMFORT", max: 35, reason: "flashing" });
    fails.push({ key: "flashing_or_excessive_contrast", evidence: "The AI reviewer saw flashing or strobing.", timestamps: flashes.slice(0, 10) });
  }
  if (observations.palette === "HARSH") {
    bounds.push({ component: "VISUAL_COMFORT", max: 45, reason: "harsh, neon or high-contrast colours" });
    fails.push({ key: "flashing_or_excessive_contrast", evidence: "Harsh, neon or intensely contrasting colours.", timestamps: [] });
  } else if (observations.palette === "BRIGHT") {
    bounds.push({ component: "VISUAL_COMFORT", max: 75, reason: "bright, saturated colours" });
  }
  if (observations.clutter === "HIGH") bounds.push({ component: "VISUAL_COMFORT", max: 65, reason: "busy, cluttered scenes" });

  if (observations.loudness === "LOUD_SPIKY") bounds.push({ component: "AUDIO_COMFORT", max: 55, reason: "loud or spiky sound" });
  if (observations.music === "INTENSE") bounds.push({ component: "AUDIO_COMFORT", max: 60, reason: "intense music" });

  if (observations.intended_audience === "ADULTS") {
    fails.push({ key: "developmental_mismatch", evidence: "Made for adults, not young children.", timestamps: [] });
  }
  return { bounds, fails };
}

export interface BookTextMetrics {
  pages: number;
  wordsPerPage: number;
  wordsPerSentence: number;
  longWordShare: number;
}

/** Measured from the stored page text: how much there is to read, and how hard it is. */
export function bookTextMetrics(pages: Array<{ text: string }>): BookTextMetrics | null {
  const texts = pages.map((page) => page.text.trim()).filter(Boolean);
  if (texts.length === 0) return null;
  const words = texts.flatMap((text) => text.split(/\s+/).filter(Boolean));
  const sentences = texts.flatMap((text) => text.split(/[.!?।]+/).filter((sentence) => sentence.trim()));
  const long = words.filter((word) => word.replace(/[^\p{L}]/gu, "").length >= 8).length;
  return {
    pages: texts.length,
    wordsPerPage: words.length / texts.length,
    wordsPerSentence: words.length / Math.max(1, sentences.length),
    longWordShare: words.length ? long / words.length : 0,
  };
}

/** Dense text is harder to follow and suits older children: it bounds Reading pace and the youngest suitable age. */
export function bookBounds(metrics: BookTextMetrics | null): { bounds: Bound[]; minAge: number | null } {
  if (!metrics) return { bounds: [], minAge: null };
  const bounds: Bound[] = [];
  let minAge: number | null = null;
  const perPage = Math.round(metrics.wordsPerPage);
  if (metrics.wordsPerPage > 80) {
    bounds.push({ component: "PACING", max: 65, reason: `about ${perPage} words a page` });
    minAge = 5;
  } else if (metrics.wordsPerPage > 50) {
    bounds.push({ component: "PACING", max: 80, reason: `about ${perPage} words a page` });
    minAge = 4;
  }
  if (metrics.wordsPerSentence > 16) {
    bounds.push({ component: "PACING", max: 70, reason: `long sentences (about ${Math.round(metrics.wordsPerSentence)} words)` });
  }
  if (metrics.longWordShare > 0.25) bounds.push({ component: "PACING", max: 75, reason: "many long words" });
  return { bounds, minAge };
}

// When a bound pulls the AI's own score down this far, the AI contradicted what it observed.
const CONTRADICTION_POINTS = 15;

/** Applies the tightest bound per component; the evidence says why, and a big correction lowers the AI's certainty. */
export function applyBounds(scores: ComponentInput[], bounds: Bound[]): ComponentInput[] {
  return scores.map((score) => {
    const relevant = bounds.filter((bound) => bound.component === score.component);
    if (score.value === null || relevant.length === 0) return score;
    const max = Math.min(...relevant.map((bound) => bound.max));
    if (score.value <= max) return score;
    const reasons = [...new Set(relevant.filter((bound) => bound.max < score.value!).map((bound) => bound.reason))].join(", ");
    return {
      ...score,
      value: max,
      evidence: `${score.evidence} Capped at ${max}: ${reasons}.`.slice(0, 500),
      selfConfidence:
        score.selfConfidence !== null && score.value - max > CONTRADICTION_POINTS ? Math.round(score.selfConfidence * 0.8 * 100) / 100 : score.selfConfidence,
    };
  });
}
