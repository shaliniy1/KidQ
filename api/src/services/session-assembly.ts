import { getCandidates } from "./content-catalog";
import type { AgeBand } from "../types/parent-config";
import type { BreakType, ContentMixMode } from "../types/curation-settings";
import type { AssembledSession, SessionSlot, SessionSlotVideo } from "../types/session";
import type { TimeBand } from "./time-band";

/**
 * Spec Section 2 has no Development-Goal -> Content-Category mapping table,
 * so "rotate across the 2-3 categories implied by that age's default
 * Development Goals" (Rule 4) can't be built literally as written. Instead,
 * Surprise-us mode rotates across whichever categories are actually present
 * in the matched candidate pool — still satisfies "no same category twice
 * in a row" (the concrete, checkable part of the rule) without inventing an
 * unspecified mapping. Flagged, not silently assumed.
 */

/**
 * Spec Rule 5 ("leans calm on purpose") names no specific calming category
 * list either — this fixed set is a reasonable, documented stand-in.
 */
const CALMING_CATEGORIES = new Set(["Storybooks", "Yoga", "Music/Rhymes"]);

function computeBreakCount(durationMinutes: number, intervalMinutes: number): number {
  // Must stay in sync with web/src/types/curation-settings.ts's
  // computeBreakCount — same formula (spec Section 1 Block E / Section 2
  // Rule 1), duplicated because api/ and web/ share no common package.
  return Math.max(1, Math.round(durationMinutes / intervalMinutes));
}

export interface AssembleSessionInput {
  childId: string;
  ageBand: AgeBand;
  durationMinutes: number;
  breakIntervalMinutes: number;
  breakType: BreakType;
  contentMixMode: ContentMixMode;
  contentMixCategories: string[];
  regulationGoals: string[];
  excludeContentIds: string[];
  timeBand: TimeBand;
}

export async function assembleSession(input: AssembleSessionInput): Promise<AssembledSession> {
  const totalBreaks = computeBreakCount(input.durationMinutes, input.breakIntervalMinutes);
  const slotTargetSeconds = (input.durationMinutes * 60) / totalBreaks;
  const wantsCalmFinish = input.regulationGoals.includes("Calm") || input.regulationGoals.includes("Relaxation");

  const restrictCategories = input.contentMixMode === "choose_categories" ? input.contentMixCategories : null;

  const { candidates, usedFallback, fallbackCategory } = await getCandidates({
    ageBand: input.ageBand,
    categories: restrictCategories,
    excludeContentIds: input.excludeContentIds,
  });

  const usedVideoIds = new Set<string>();
  let lastCategory: string | null = null;
  const slots: SessionSlot[] = [];

  for (let slotIndex = 0; slotIndex < totalBreaks; slotIndex++) {
    const isFinalSlot = slotIndex === totalBreaks - 1;
    const unusedPool = candidates.filter((candidate) => !usedVideoIds.has(candidate.content_id));
    // "Never repeat a video within a session" is a sensible default this
    // build adds (not spec-mandated) — but it must never win over actually
    // filling a break slot. A thin catalog (like this seed data) can
    // exhaust the no-repeat pool before every slot is filled; when that
    // happens, fall back to allowing repeats rather than leave a slot
    // silently empty (found via testing: a 45-min/3-slot session against a
    // 6-video age-band pool left the final slot empty before this fix).
    const pool = unusedPool.length > 0 ? unusedPool : candidates;

    // Rank the remaining pool for this slot: on the final slot, prefer
    // calming categories when a calming goal is active (Rule 5); always
    // prefer a category that isn't the immediately preceding video's
    // (rotation, Rule 4) — a stable sort otherwise keeps catalog order
    // (see content-catalog.ts's own placeholder-ranking note).
    const ranked = [...pool].sort((a, b) => {
      if (isFinalSlot && wantsCalmFinish) {
        const aCalm = a.category !== null && CALMING_CATEGORIES.has(a.category);
        const bCalm = b.category !== null && CALMING_CATEGORIES.has(b.category);
        if (aCalm !== bCalm) return aCalm ? -1 : 1;
      }
      const aRepeats = a.category === lastCategory;
      const bRepeats = b.category === lastCategory;
      if (aRepeats !== bRepeats) return aRepeats ? 1 : -1;
      return 0;
    });

    const slotVideos: SessionSlotVideo[] = [];
    let accumulatedSeconds = 0;

    for (const candidate of ranked) {
      if (slotVideos.length > 0 && accumulatedSeconds >= slotTargetSeconds) break;
      const duration = candidate.duration_seconds ?? 0;
      // Never cut a video short (Rule 3): a slot always takes at least one
      // video even if it alone exceeds the target — the break lands after
      // it, not mid-play.
      slotVideos.push({
        contentId: candidate.content_id,
        title: candidate.title,
        category: candidate.category,
        durationSeconds: duration,
        embedUrl: candidate.embed_url,
        thumbnailUrl: candidate.thumbnail_url,
      });
      usedVideoIds.add(candidate.content_id);
      accumulatedSeconds += duration;
      lastCategory = candidate.category;
      if (accumulatedSeconds >= slotTargetSeconds) break;
    }

    slots.push({ index: slotIndex, videos: slotVideos, isFinalSlot });
  }

  return {
    childId: input.childId,
    durationMinutes: input.durationMinutes,
    breakIntervalMinutes: input.breakIntervalMinutes,
    breakType: input.breakType,
    totalBreaks,
    slots,
    usedFallback,
    fallbackCategory,
    timeBand: input.timeBand,
    assembledAt: new Date().toISOString(),
  };
}
